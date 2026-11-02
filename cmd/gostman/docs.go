package main

import (
	"encoding/base64"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"net/url"
	"regexp"
	"strings"
	"unicode"

	"github.com/kunalgoesbyken/gostman/gitutil"
	"github.com/kunalgoesbyken/gostman/runner"
	"github.com/kunalgoesbyken/gostman/runner/sandbox"
)

const (
	docsBuilder     = "buildDocs"
	docsPermissions = 0o644
	docsLogoLimit   = 300 << 10
	docsPage        = "index.html"
)

var (
	docsAccent    = regexp.MustCompile(`^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$`)
	logoTypes     = map[string]string{".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml"}
)

type docsVersion struct {
	Label   string `json:"label"`
	Href    string `json:"href"`
	Current bool   `json:"current,omitempty"`
}

type docsOptions struct {
	Title           string        `json:"title,omitempty"`
	IncludeExamples bool          `json:"includeExamples"`
	Playground      bool          `json:"playground"`
	Accent          string        `json:"accent,omitempty"`
	Logo            string        `json:"logo,omitempty"`
	Versions        []docsVersion `json:"versions,omitempty"`
}

type documenting struct {
	source   string
	output   string
	options  docsOptions
	refs     []string
	allTags  bool
	logoPath string
}

func splitRefs(list string) []string {
	var refs []string
	for _, part := range strings.Split(list, ",") {
		if ref := strings.TrimSpace(part); ref != "" {
			refs = append(refs, ref)
		}
	}
	return refs
}

func logoData(path string) (string, error) {
	kind, known := logoTypes[strings.ToLower(filepath.Ext(path))]
	if !known {
		return "", errors.New("--logo takes a png, jpg, gif, webp or svg file")
	}
	content, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	if len(content) > docsLogoLimit {
		return "", fmt.Errorf("the logo is larger than %d KB", docsLogoLimit>>10)
	}
	return "data:" + kind + ";base64," + base64.StdEncoding.EncodeToString(content), nil
}

func parseDocumenting(arguments []string) (documenting, error) {
	var parsed documenting
	flags := flag.NewFlagSet("docs", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	flags.StringVar(&parsed.output, "output", "", "")
	flags.StringVar(&parsed.options.Title, "title", "", "")
	withoutExamples := flags.Bool("no-examples", false, "")
	flags.BoolVar(&parsed.options.Playground, "playground", false, "")
	flags.StringVar(&parsed.options.Accent, "accent", "", "")
	flags.StringVar(&parsed.logoPath, "logo", "", "")
	versions := flags.String("versions", "", "")
	flags.BoolVar(&parsed.allTags, "all-tags", false, "")
	positional, err := parseInterspersed(flags, arguments)
	if err != nil {
		return parsed, err
	}
	if len(positional) != 1 {
		return parsed, errors.New("name one workspace folder or export file")
	}
	parsed.source = positional[0]
	parsed.options.IncludeExamples = !*withoutExamples
	parsed.refs = splitRefs(*versions)
	if parsed.options.Accent != "" && !docsAccent.MatchString(parsed.options.Accent) {
		return parsed, errors.New("--accent takes a hex colour such as #0b6bcb")
	}
	if parsed.logoPath != "" {
		if parsed.options.Logo, err = logoData(parsed.logoPath); err != nil {
			return parsed, err
		}
	}
	if parsed.allTags && len(parsed.refs) > 0 {
		return parsed, errors.New("use --versions or --all-tags, not both")
	}
	if (parsed.allTags || len(parsed.refs) > 0) && parsed.output == "" {
		return parsed, errors.New("--versions and --all-tags write one folder per version: name the folder with --output")
	}
	return parsed, nil
}

func (d documenting) versioned() bool {
	return d.allTags || len(d.refs) > 0
}

func versionDirectory(ref string) string {
	safe := strings.Map(func(character rune) rune {
		if unicode.IsLetter(character) || unicode.IsDigit(character) || strings.ContainsRune("._-", character) {
			return character
		}
		return '-'
	}, ref)
	return strings.Trim(safe, ".-")
}

func (d documenting) resolveRefs() ([]string, error) {
	if !d.allTags {
		return d.refs, nil
	}
	repo, err := gitutil.Open(d.source, true)
	if err != nil {
		return nil, err
	}
	tags, err := repo.Tags()
	if err != nil {
		return nil, err
	}
	if len(tags) == 0 {
		return nil, errors.New("this repository has no tags")
	}
	return tags, nil
}

func (d documenting) versionLinks(refs []string, current string) []docsVersion {
	links := make([]docsVersion, len(refs))
	for i, ref := range refs {
		directory := versionDirectory(ref)
		links[i] = docsVersion{Label: ref, Href: "../" + url.PathEscape(directory) + "/" + docsPage, Current: directory == current}
	}
	return links
}

func (d documenting) renderRef(ref, folder string, refs []string) (string, error) {
	scratch, err := os.MkdirTemp("", "gostman-docs-*")
	if err != nil {
		return "", err
	}
	defer os.RemoveAll(scratch)
	if err := gitutil.ExportRef(d.source, ref, scratch); err != nil {
		return "", err
	}
	versioned := d
	versioned.source = scratch
	versioned.options.Versions = d.versionLinks(refs, folder)
	return versioned.render()
}

const redirectPage = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=%[1]s"><title>Documentation</title></head>
<body><p><a href="%[1]s">Open the documentation</a></p></body></html>
`

func (d documenting) buildVersions(stdout io.Writer) error {
	refs, err := d.resolveRefs()
	if err != nil {
		return err
	}
	seen := map[string]bool{}
	for _, ref := range refs {
		directory := versionDirectory(ref)
		if directory == "" || seen[directory] {
			return fmt.Errorf("the version %q needs a name that is different from the others", ref)
		}
		seen[directory] = true
	}
	for _, ref := range refs {
		directory := versionDirectory(ref)
		page, err := d.renderRef(ref, directory, refs)
		if err != nil {
			return fmt.Errorf("%s: %w", ref, err)
		}
		target := filepath.Join(d.output, directory)
		if err := os.MkdirAll(target, 0o755); err != nil {
			return err
		}
		if err := os.WriteFile(filepath.Join(target, docsPage), []byte(page), docsPermissions); err != nil {
			return err
		}
		fmt.Fprintf(stdout, "Wrote %s (%d bytes).\n", filepath.Join(target, docsPage), len(page))
	}
	latest := url.PathEscape(versionDirectory(refs[len(refs)-1])) + "/" + docsPage
	return os.WriteFile(filepath.Join(d.output, docsPage), []byte(fmt.Sprintf(redirectPage, latest)), docsPermissions)
}

func (d documenting) render() (string, error) {
	collection, err := runner.Load(d.source)
	if err != nil {
		return "", err
	}
	var page string
	return page, sandbox.Render(docsBuilder, &page, collection, d.options)
}

func (d documenting) deliver(page string, stdout io.Writer) error {
	if d.output == "" {
		_, err := io.WriteString(stdout, page)
		return err
	}
	if err := os.WriteFile(d.output, []byte(page), docsPermissions); err != nil {
		return err
	}
	_, err := fmt.Fprintf(stdout, "Wrote %s (%d bytes).\n", d.output, len(page))
	return err
}

func docsCommand(arguments []string, stdout, stderr *os.File) int {
	parsed, err := parseDocumenting(arguments)
	if err != nil {
		return misuse(stderr, err.Error())
	}
	if parsed.versioned() {
		if err := parsed.buildVersions(stdout); err != nil {
			return complain(stderr, err)
		}
		return exitPassed
	}
	page, err := parsed.render()
	if err != nil {
		return complain(stderr, err)
	}
	if err := parsed.deliver(page, stdout); err != nil {
		return complain(stderr, err)
	}
	return exitPassed
}
