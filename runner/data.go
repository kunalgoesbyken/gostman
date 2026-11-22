package runner

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"maps"
	"os"
	"path/filepath"
	"strings"
	"unicode"
)

type Row map[string]json.RawMessage

const (
	iterationName      = "iteration"
	iterationCountName = "iterationCount"
)

func (o Options) DataValues() map[string]string {
	values := map[string]string{}
	for _, row := range o.Data {
		for name, raw := range row {
			values[name] = plainText(raw)
		}
	}
	return values
}

func LoadData(path string) ([]Row, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("cannot read the data file: %w", err)
	}
	return ParseData(path, content)
}

func ParseData(path string, content []byte) ([]Row, error) {
	var rows []Row
	var err error
	extension := strings.ToLower(filepath.Ext(path))
	if extension == ".xlsx" {
		rows, err = parseXLSXRows(content)
		return finishRows(path, rows, err)
	}
	content, err = DecodeText(content)
	if err != nil {
		return nil, fmt.Errorf("cannot read the data file: %w", err)
	}
	if extension == ".json" {
		rows, err = parseJSONRows(content)
	} else {
		rows, err = parseCSVRows(content)
	}
	return finishRows(path, rows, err)
}

func finishRows(path string, rows []Row, err error) ([]Row, error) {
	if err != nil {
		return nil, fmt.Errorf("%s: %w", path, err)
	}
	if len(rows) == 0 {
		return nil, fmt.Errorf("%s has no rows", path)
	}
	return rows, nil
}

func parseCSVRows(content []byte) ([]Row, error) {
	reader := csv.NewReader(bytes.NewReader(content))
	reader.FieldsPerRecord = -1
	reader.TrimLeadingSpace = true
	header, err := reader.Read()
	if errors.Is(err, io.EOF) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("the CSV cannot be read: %w", err)
	}
	for index, name := range header {
		header[index] = strings.TrimSpace(name)
	}
	var rows []Row
	for {
		record, err := reader.Read()
		if errors.Is(err, io.EOF) {
			return rows, nil
		}
		if err != nil {
			return nil, fmt.Errorf("the CSV cannot be read: %w", err)
		}
		if len(record) == 1 && strings.TrimSpace(record[0]) == "" {
			continue
		}
		row := Row{}
		for index, name := range header {
			if name == "" {
				continue
			}
			value := ""
			if index < len(record) {
				value = record[index]
			}
			encoded, _ := json.Marshal(value)
			row[name] = encoded
		}
		rows = append(rows, row)
	}
}

func parseJSONRows(content []byte) ([]Row, error) {
	var rows []Row
	if err := json.Unmarshal(content, &rows); err != nil {
		return nil, errors.New("a JSON data file must be an array of objects, one object per iteration")
	}
	return rows, nil
}

const MaxIterations = 10000

func (o Options) CheckIterations() error {
	if err := o.checkRows(); err != nil {
		return err
	}
	if err := o.checkRowLabel(); err != nil {
		return err
	}
	if requested := max(o.Iterations, o.iterationCount()); requested > MaxIterations {
		return fmt.Errorf("a run is limited to %d iterations, this one asks for %d; lower the iteration count or use fewer data rows", MaxIterations, requested)
	}
	return nil
}

func (o Options) checkRows() error {
	if len(o.Rows) == 0 {
		return nil
	}
	if len(o.Data) == 0 {
		return errors.New("rows can only be chosen from a data file")
	}
	if o.Iterations > 0 {
		return errors.New("choose rows or an iteration count, not both")
	}
	for _, row := range o.Rows {
		if row < 1 || row > len(o.Data) {
			return fmt.Errorf("row %d is not in the data file, which has %d rows", row, len(o.Data))
		}
	}
	return nil
}

func (o Options) checkRowLabel() error {
	if o.RowLabel == "" {
		return nil
	}
	if len(o.Data) == 0 {
		return errors.New("iterations can only be labelled from a data file")
	}
	for _, row := range o.Data {
		if _, found := row[o.RowLabel]; found {
			return nil
		}
	}
	return fmt.Errorf("the data file has no column %q to label iterations with", o.RowLabel)
}

func (o Options) iterationCount() int {
	if len(o.Rows) > 0 {
		return len(o.Rows)
	}
	count := len(o.Data)
	if count == 0 {
		count = 1
	}
	if o.Iterations > 0 && (len(o.Data) == 0 || o.Iterations < len(o.Data)) {
		count = o.Iterations
	}
	return count
}

func (o Options) rowIndex(iteration int) int {
	if len(o.Rows) > 0 {
		return o.Rows[iteration] - 1
	}
	return iteration
}

func (o Options) iterationNumber(iteration int) int {
	if !o.isIterating() {
		return 0
	}
	return o.rowIndex(iteration) + 1
}

func (o Options) labelFor(iteration int) string {
	row := o.rowIndex(iteration)
	if o.RowLabel == "" || row >= len(o.Data) {
		return ""
	}
	raw, found := o.Data[row][o.RowLabel]
	if !found || string(raw) == "null" {
		return ""
	}
	return strings.Join(strings.FieldsFunc(plainText(raw), isLabelBreak), " ")
}

func isLabelBreak(character rune) bool {
	return unicode.IsSpace(character) || unicode.IsControl(character)
}

func (o Options) scriptIterationCount() int {
	if len(o.Rows) > 0 {
		return len(o.Data)
	}
	return o.iterationCount()
}

func (o Options) isIterating() bool {
	return len(o.Data) > 0 || o.Iterations > 1
}

func (o Options) givenFor(iteration int) Row {
	if !o.isIterating() {
		return nil
	}
	given := Row{}
	if row := o.rowIndex(iteration); row < len(o.Data) {
		maps.Copy(given, o.Data[row])
	}
	given[iterationName] = json.RawMessage(fmt.Sprint(o.iterationNumber(iteration)))
	given[iterationCountName] = json.RawMessage(fmt.Sprint(o.scriptIterationCount()))
	return given
}

func (v variables) withdraw(row Row, before variables) {
	for name, value := range row {
		if current, found := v[name]; !found || !bytes.Equal(current, value) {
			continue
		}
		if earlier, found := before[name]; found {
			v[name] = earlier
		} else {
			delete(v, name)
		}
	}
}
