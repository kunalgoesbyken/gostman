package main

import (
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"strings"

	"golang.org/x/image/font/sfnt"
)

var fontExtensions = []string{".ttf", ".otf", ".ttc", ".otc"}

func fontDirectories() []string {
	home, _ := os.UserHomeDir()
	switch runtime.GOOS {
	case "windows":
		return []string{
			filepath.Join(os.Getenv("WINDIR"), "Fonts"),
			filepath.Join(os.Getenv("LOCALAPPDATA"), "Microsoft", "Windows", "Fonts"),
		}
	case "darwin":
		return []string{"/System/Library/Fonts", "/Library/Fonts", filepath.Join(home, "Library", "Fonts")}
	default:
		directories := []string{"/usr/share/fonts", "/usr/local/share/fonts", filepath.Join(home, ".local", "share", "fonts"), filepath.Join(home, ".fonts")}
		for _, data := range filepath.SplitList(os.Getenv("XDG_DATA_DIRS")) {
			directories = append(directories, filepath.Join(data, "fonts"))
		}
		return directories
	}
}

func searchedDirectories() []string {
	directories := slices.DeleteFunc(fontDirectories(), func(directory string) bool { return !filepath.IsAbs(directory) })
	slices.Sort(directories)
	return slices.Compact(directories)
}

func isFontFile(path string) bool {
	return slices.Contains(fontExtensions, strings.ToLower(filepath.Ext(path)))
}

func familyOf(font *sfnt.Font, buffer *sfnt.Buffer) string {
	for _, id := range []sfnt.NameID{sfnt.NameIDTypographicFamily, sfnt.NameIDFamily} {
		if name, err := font.Name(buffer, id); err == nil && strings.TrimSpace(name) != "" {
			return strings.TrimSpace(name)
		}
	}
	return ""
}

func fontsIn(file *os.File) []*sfnt.Font {
	collection, err := sfnt.ParseCollectionReaderAt(file)
	if err != nil {
		return nil
	}
	fonts := make([]*sfnt.Font, 0, collection.NumFonts())
	for index := range collection.NumFonts() {
		if font, err := collection.Font(index); err == nil {
			fonts = append(fonts, font)
		}
	}
	return fonts
}

func familiesInFile(path string, buffer *sfnt.Buffer) []string {
	file, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer file.Close()
	var families []string
	for _, font := range fontsIn(file) {
		if family := familyOf(font, buffer); family != "" && !strings.HasPrefix(family, ".") {
			families = append(families, family)
		}
	}
	return families
}

func collectFamilies(directory string, buffer *sfnt.Buffer, found map[string]bool) {
	filepath.WalkDir(directory, func(path string, entry fs.DirEntry, err error) error {
		if err != nil || entry.IsDir() || !isFontFile(path) {
			return nil
		}
		for _, family := range familiesInFile(path, buffer) {
			found[family] = true
		}
		return nil
	})
}

func (a *App) InstalledFonts() []string {
	found := map[string]bool{}
	buffer := &sfnt.Buffer{}
	for _, directory := range searchedDirectories() {
		collectFamilies(directory, buffer, found)
	}
	families := make([]string, 0, len(found))
	for family := range found {
		families = append(families, family)
	}
	return families
}
