package main

import (
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strings"
)

const (
	ciFilePerm   = 0o644
	ciFolderPerm = 0o755
	releaseURL   = "https://github.com/kunalgoesbyken/gostman/releases/latest/download/gostman-cli-linux-amd64.tar.gz"
	installSteps = "curl -fsSL -o gostman.tar.gz " + releaseURL + " && tar -xzf gostman.tar.gz"
)

type ciTemplate struct {
	path string
	text string
}

var ciTemplates = map[string]ciTemplate{
	"github": {".github/workflows/gostman.yml", `name: Gostman
on: [push, pull_request]

permissions:
  contents: read
  pull-requests: write

jobs:
  api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: kunalgoesbyken/gostman@main
        with:
          collection: %[1]s
          reporter: junit
          output: report.xml
          comment: true
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: gostman-report
          path: report.xml
`},
	"gitlab": {".gitlab-ci.yml", `gostman:
  image: alpine:3.20
  before_script:
    - apk add --no-cache curl
    - ` + installSteps + `
  script:
    - ./gostman run %[1]s --reporter junit --output report.xml
  artifacts:
    when: always
    reports:
      junit: report.xml
`},
	"azure": {"azure-pipelines.yml", `trigger:
  - main

pool:
  vmImage: ubuntu-latest

steps:
  - script: ` + installSteps + `
    displayName: Install Gostman
  - script: ./gostman run %[1]s --reporter junit --output report.xml
    displayName: Run collection
  - task: PublishTestResults@2
    condition: always()
    inputs:
      testResultsFormat: JUnit
      testResultsFiles: report.xml
`},
	"circleci": {".circleci/config.yml", `version: 2.1

jobs:
  gostman:
    docker:
      - image: cimg/base:stable
    steps:
      - checkout
      - run:
          name: Install Gostman
          command: ` + installSteps + `
      - run:
          name: Run collection
          command: ./gostman run %[1]s --reporter junit --output test-results/gostman/report.xml
      - store_test_results:
          path: test-results

workflows:
  api:
    jobs:
      - gostman
`},
	"bitbucket": {"bitbucket-pipelines.yml", `image: alpine:3.20

pipelines:
  default:
    - step:
        name: Gostman
        script:
          - apk add --no-cache curl
          - ` + installSteps + `
          - ./gostman run %[1]s --reporter junit --output test-results/report.xml
`},
}

func ciNames() []string {
	names := make([]string, 0, len(ciTemplates))
	for name := range ciTemplates {
		names = append(names, name)
	}
	slices.Sort(names)
	return names
}

func checkCI(provider string) error {
	if provider == "" {
		return nil
	}
	if _, known := ciTemplates[provider]; !known {
		return fmt.Errorf("unknown --ci provider %q; choose %s", provider, strings.Join(ciNames(), ", "))
	}
	return nil
}

func writeCI(provider, workspaceRoot string, stdout io.Writer) error {
	template := ciTemplates[provider]
	target, err := filepath.Abs(filepath.FromSlash(template.path))
	if err != nil {
		return err
	}
	relative := workspaceRoot
	if current, err := os.Getwd(); err == nil {
		if inside, err := filepath.Rel(current, workspaceRoot); err == nil && !strings.HasPrefix(inside, "..") {
			relative = inside
		}
	}
	if err := os.MkdirAll(filepath.Dir(target), ciFolderPerm); err != nil {
		return err
	}
	file, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_EXCL, ciFilePerm)
	if errors.Is(err, fs.ErrExist) {
		fmt.Fprintf(stdout, "%s already exists and was left as it is.\n", template.path)
		return nil
	}
	if err != nil {
		return err
	}
	defer file.Close()
	if _, err := fmt.Fprintf(file, template.text, filepath.ToSlash(relative)); err != nil {
		return err
	}
	fmt.Fprintf(stdout, "Wrote %s, which runs %s on every push. Set secrets as CI variables and pass them with --var-from-env.\n", template.path, filepath.ToSlash(relative))
	return nil
}
