package runner

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

type Row map[string]json.RawMessage

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
	content = bytes.TrimPrefix(content, []byte(byteOrderMark))
	var rows []Row
	if strings.EqualFold(filepath.Ext(path), ".json") {
		rows, err = parseJSONRows(content)
	} else {
		rows, err = parseCSVRows(content)
	}
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

func (o Options) iterationCount() int {
	count := len(o.Data)
	if count == 0 {
		count = 1
	}
	if o.Iterations > 0 && (len(o.Data) == 0 || o.Iterations < len(o.Data)) {
		count = o.Iterations
	}
	return count
}

func (o Options) isIterating() bool {
	return len(o.Data) > 0 || o.Iterations > 1
}

func startingFor(base variables, options Options, iteration, count int) variables {
	starting := make(variables, len(base))
	for name, value := range base {
		starting[name] = value
	}
	if iteration < len(options.Data) {
		for name, value := range options.Data[iteration] {
			starting[name] = value
		}
	}
	if options.isIterating() {
		starting["iteration"] = json.RawMessage(fmt.Sprint(iteration + 1))
		starting["iterationCount"] = json.RawMessage(fmt.Sprint(count))
	}
	return starting
}
