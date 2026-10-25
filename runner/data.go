package runner

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"maps"
	"path/filepath"
	"strings"
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
	content, err := ReadText(path)
	if err != nil {
		return nil, fmt.Errorf("cannot read the data file: %w", err)
	}
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

const MaxIterations = 10000

func (o Options) CheckIterations() error {
	if requested := max(o.Iterations, o.iterationCount()); requested > MaxIterations {
		return fmt.Errorf("a run is limited to %d iterations, this one asks for %d; lower the iteration count or use fewer data rows", MaxIterations, requested)
	}
	return nil
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

func (o Options) givenFor(iteration int) Row {
	if !o.isIterating() {
		return nil
	}
	given := Row{}
	if iteration < len(o.Data) {
		maps.Copy(given, o.Data[iteration])
	}
	given[iterationName] = json.RawMessage(fmt.Sprint(iteration + 1))
	given[iterationCountName] = json.RawMessage(fmt.Sprint(o.iterationCount()))
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
