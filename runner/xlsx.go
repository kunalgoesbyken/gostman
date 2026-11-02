package runner

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"path"
	"strconv"
	"strings"
)

const maxSpreadsheetPart = 64 << 20

type sheetRef struct {
	Name string `xml:"name,attr"`
	ID   string `xml:"http://schemas.openxmlformats.org/officeDocument/2006/relationships id,attr"`
}

type workbookXML struct {
	Sheets []sheetRef `xml:"sheets>sheet"`
}

type relationshipsXML struct {
	Items []struct {
		ID     string `xml:"Id,attr"`
		Target string `xml:"Target,attr"`
	} `xml:"Relationship"`
}

type richText struct {
	Plain string   `xml:"t"`
	Runs  []string `xml:"r>t"`
}

func (r richText) text() string {
	return r.Plain + strings.Join(r.Runs, "")
}

type sharedStringsXML struct {
	Items []richText `xml:"si"`
}

type cellXML struct {
	Ref    string    `xml:"r,attr"`
	Type   string    `xml:"t,attr"`
	Value  string    `xml:"v"`
	Inline *richText `xml:"is"`
}

type rowXML struct {
	Cells []cellXML `xml:"c"`
}

type sheetXML struct {
	Rows []rowXML `xml:"sheetData>row"`
}

func parseXLSXRows(content []byte) ([]Row, error) {
	archive, err := zip.NewReader(bytes.NewReader(content), int64(len(content)))
	if err != nil {
		return nil, errors.New("the file is not a valid XLSX workbook")
	}
	parts := map[string]*zip.File{}
	for _, file := range archive.File {
		parts[file.Name] = file
	}
	sheetPath, err := firstSheetPath(parts)
	if err != nil {
		return nil, err
	}
	var shared sharedStringsXML
	if part, found := parts["xl/sharedStrings.xml"]; found {
		if err := decodePart(part, &shared); err != nil {
			return nil, err
		}
	}
	sheetPart, found := parts[sheetPath]
	if !found {
		return nil, errors.New("the first sheet is missing from the workbook")
	}
	var sheet sheetXML
	if err := decodePart(sheetPart, &sheet); err != nil {
		return nil, err
	}
	return sheetRows(sheet, shared), nil
}

func firstSheetPath(parts map[string]*zip.File) (string, error) {
	workbookPart, found := parts["xl/workbook.xml"]
	if !found {
		return "", errors.New("the file is not a valid XLSX workbook")
	}
	var workbook workbookXML
	if err := decodePart(workbookPart, &workbook); err != nil {
		return "", err
	}
	if len(workbook.Sheets) == 0 {
		return "", errors.New("the workbook has no sheets")
	}
	if relsPart, found := parts["xl/_rels/workbook.xml.rels"]; found {
		var rels relationshipsXML
		if err := decodePart(relsPart, &rels); err != nil {
			return "", err
		}
		for _, item := range rels.Items {
			if item.ID != workbook.Sheets[0].ID {
				continue
			}
			if strings.HasPrefix(item.Target, "/") {
				return strings.TrimPrefix(item.Target, "/"), nil
			}
			return path.Join("xl", item.Target), nil
		}
	}
	return "xl/worksheets/sheet1.xml", nil
}

func decodePart(part *zip.File, into any) error {
	reader, err := part.Open()
	if err != nil {
		return err
	}
	defer reader.Close()
	var buffer bytes.Buffer
	if _, err := io.Copy(&buffer, io.LimitReader(reader, maxSpreadsheetPart+1)); err != nil {
		return err
	}
	if buffer.Len() > maxSpreadsheetPart {
		return errors.New("the workbook is too large")
	}
	if err := xml.Unmarshal(buffer.Bytes(), into); err != nil {
		return fmt.Errorf("the workbook cannot be read: %w", err)
	}
	return nil
}

func sheetRows(sheet sheetXML, shared sharedStringsXML) []Row {
	var table [][]string
	for _, row := range sheet.Rows {
		var line []string
		for _, cell := range row.Cells {
			column := columnIndex(cell.Ref)
			if column < 0 {
				column = len(line)
			}
			for len(line) <= column {
				line = append(line, "")
			}
			line[column] = cellText(cell, shared)
		}
		table = append(table, line)
	}
	if len(table) == 0 {
		return nil
	}
	header := table[0]
	for index, name := range header {
		header[index] = strings.TrimSpace(name)
	}
	var rows []Row
	for _, line := range table[1:] {
		if blankLine(line) {
			continue
		}
		row := Row{}
		for index, name := range header {
			if name == "" {
				continue
			}
			value := ""
			if index < len(line) {
				value = line[index]
			}
			encoded, _ := json.Marshal(value)
			row[name] = encoded
		}
		rows = append(rows, row)
	}
	return rows
}

func blankLine(line []string) bool {
	for _, value := range line {
		if strings.TrimSpace(value) != "" {
			return false
		}
	}
	return true
}

func cellText(cell cellXML, shared sharedStringsXML) string {
	switch cell.Type {
	case "s":
		index, err := strconv.Atoi(strings.TrimSpace(cell.Value))
		if err != nil || index < 0 || index >= len(shared.Items) {
			return ""
		}
		return shared.Items[index].text()
	case "inlineStr":
		if cell.Inline == nil {
			return ""
		}
		return cell.Inline.text()
	case "b":
		if strings.TrimSpace(cell.Value) == "1" {
			return "true"
		}
		return "false"
	default:
		return strings.TrimSpace(cell.Value)
	}
}

func columnIndex(ref string) int {
	index := 0
	letters := 0
	for _, character := range ref {
		if character < 'A' || character > 'Z' {
			break
		}
		index = index*26 + int(character-'A') + 1
		letters++
	}
	if letters == 0 {
		return -1
	}
	return index - 1
}
