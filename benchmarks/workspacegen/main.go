package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/kunalgoesbyken/gostman/workspace"
)

var methods = []string{"GET", "POST", "PUT", "PATCH", "DELETE"}

var tagSets = [][]string{{"smoke"}, {"users"}, {"billing", "slow"}, nil, {"admin"}}

type options struct {
	out      string
	jsonOut  string
	requests int
	depth    int
	fanout   int
	baseURL  string
}

type webRequest struct {
	Id          string   `json:"id"`
	Name        string   `json:"name"`
	Tags        []string `json:"tags,omitempty"`
	URL         string   `json:"url"`
	Method      string   `json:"method"`
	Headers     string   `json:"headers"`
	Body        string   `json:"body,omitempty"`
	BodyType    string   `json:"bodyType"`
	QueryParams string   `json:"queryParams"`
	FolderId    string   `json:"folderId"`
	SortOrder   int64    `json:"sortOrder"`
}

type webFolder struct {
	Id        string `json:"id"`
	Name      string `json:"name"`
	ParentId  string `json:"parentId"`
	SortOrder int64  `json:"sortOrder"`
	IsOpen    bool   `json:"isOpen"`
}

type webDocument struct {
	Requests []webRequest `json:"requests"`
	Folders  []webFolder  `json:"folders"`
	History  []any        `json:"history"`
}

func main() {
	var o options
	flag.StringVar(&o.out, "out", "", "folder to create the YAML workspace in (must be missing or empty)")
	flag.StringVar(&o.jsonOut, "json", "", "file to write the same collection to as a web app data document")
	flag.IntVar(&o.requests, "requests", 5000, "number of requests")
	flag.IntVar(&o.depth, "depth", 3, "folder levels")
	flag.IntVar(&o.fanout, "fanout", 6, "subfolders per folder")
	flag.StringVar(&o.baseURL, "base-url", "http://127.0.0.1:3901", "base URL of every request")
	flag.Parse()
	if o.out == "" && o.jsonOut == "" {
		log.Fatal("give -out, -json or both")
	}

	collection := generate(o)
	if o.out != "" {
		if _, err := workspace.Create(o.out, collection); err != nil {
			log.Fatalf("create workspace: %v", err)
		}
	}
	if o.jsonOut != "" {
		if err := writeDocument(o.jsonOut, collection); err != nil {
			log.Fatalf("write %s: %v", o.jsonOut, err)
		}
	}
	fmt.Printf("%d requests in %d folders\n", len(collection.Requests), len(collection.Folders))
}

func generate(o options) workspace.Collection {
	var folders []workspace.Folder
	leaves := []string{""}
	for level := 0; level < o.depth; level++ {
		var next []string
		for _, parent := range leaves {
			for index := 0; index < o.fanout; index++ {
				id := fmt.Sprintf("bench-folder-%04d", len(folders)+1)
				folders = append(folders, workspace.Folder{
					Id:        id,
					Name:      fmt.Sprintf("Area %d.%d", level+1, index+1),
					ParentId:  parent,
					SortOrder: int64(index + 1),
				})
				next = append(next, id)
			}
		}
		leaves = next
	}

	requests := make([]workspace.Request, 0, o.requests)
	for index := 0; index < o.requests; index++ {
		requests = append(requests, request(index, leaves[index%len(leaves)], o.baseURL))
	}
	return workspace.Collection{Folders: folders, Requests: requests}
}

func request(index int, folderID, baseURL string) workspace.Request {
	method := methods[index%len(methods)]
	number := index + 1
	r := workspace.Request{
		Id:          fmt.Sprintf("bench-request-%05d", number),
		Name:        fmt.Sprintf("%s item %d", method, number),
		Tags:        tagSets[index%len(tagSets)],
		URL:         fmt.Sprintf("%s/items/%d?page=%d", baseURL, number, number%7),
		Method:      method,
		Headers:     `[{"key":"Accept","value":"application/json","enabled":true},{"key":"X-Trace","value":"{{trace}}","enabled":true}]`,
		BodyType:    "none",
		QueryParams: "[]",
		FolderId:    folderID,
		SortOrder:   int64(index + 1),
	}
	if method == "POST" || method == "PUT" || method == "PATCH" {
		r.BodyType = "json"
		r.Body = fmt.Sprintf("{\n  \"id\": %d,\n  \"name\": \"Item %d\",\n  \"active\": true\n}", number, number)
	}
	return r
}

func writeDocument(path string, collection workspace.Collection) error {
	document := webDocument{History: []any{}}
	for _, r := range collection.Requests {
		document.Requests = append(document.Requests, webRequest{
			Id: r.Id, Name: r.Name, Tags: r.Tags, URL: r.URL, Method: r.Method, Headers: r.Headers,
			Body: r.Body, BodyType: r.BodyType, QueryParams: r.QueryParams, FolderId: r.FolderId, SortOrder: r.SortOrder,
		})
	}
	for _, f := range collection.Folders {
		document.Folders = append(document.Folders, webFolder{Id: f.Id, Name: f.Name, ParentId: f.ParentId, SortOrder: f.SortOrder, IsOpen: true})
	}
	content, err := json.Marshal(document)
	if err != nil {
		return err
	}
	return os.WriteFile(path, content, 0o644)
}
