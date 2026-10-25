package workspace

import (
	"cmp"
	"slices"
)

const sharedOrderKey = "sharedOrder"

type Sibling struct {
	Folder  *Folder
	Request *Request
}

func compareOrder(first, second int64) int {
	switch {
	case first == second || first <= 0 && second <= 0:
		return 0
	case first <= 0:
		return 1
	case second <= 0:
		return -1
	}
	return cmp.Compare(first, second)
}

func OrderSiblings(folders []Folder, requests []Request, shared bool) []Sibling {
	slices.SortStableFunc(folders, func(a, b Folder) int { return compareOrder(a.SortOrder, b.SortOrder) })
	slices.SortStableFunc(requests, func(a, b Request) int { return compareOrder(a.SortOrder, b.SortOrder) })
	siblings := make([]Sibling, 0, len(folders)+len(requests))
	folderIndex, requestIndex := 0, 0
	for folderIndex < len(folders) || requestIndex < len(requests) {
		requestFirst := requestIndex < len(requests) && (folderIndex == len(folders) || shared && compareOrder(requests[requestIndex].SortOrder, folders[folderIndex].SortOrder) < 0)
		if requestFirst {
			siblings = append(siblings, Sibling{Request: &requests[requestIndex]})
			requestIndex++
			continue
		}
		siblings = append(siblings, Sibling{Folder: &folders[folderIndex]})
		folderIndex++
	}
	return siblings
}

func SiblingGroups(folders []Folder, requests []Request, shared bool) map[string][]Sibling {
	known := map[string]bool{}
	for _, folder := range folders {
		known[folder.Id] = true
	}
	childFolders := map[string][]Folder{}
	for _, folder := range folders {
		parent := folder.ParentId
		if !known[parent] || parent == folder.Id {
			parent = ""
		}
		childFolders[parent] = append(childFolders[parent], folder)
	}
	childRequests := map[string][]Request{}
	for _, request := range requests {
		parent := request.FolderId
		if !known[parent] {
			parent = ""
		}
		childRequests[parent] = append(childRequests[parent], request)
	}
	groups := map[string][]Sibling{}
	for parent, children := range childFolders {
		groups[parent] = OrderSiblings(children, childRequests[parent], shared)
	}
	for parent, children := range childRequests {
		if _, ordered := groups[parent]; !ordered {
			groups[parent] = OrderSiblings(nil, children, shared)
		}
	}
	return groups
}

func ShareOrder(folders []Folder, requests []Request) {
	folderPlaces, requestPlaces := map[string]int64{}, map[string]int64{}
	for _, siblings := range SiblingGroups(folders, requests, false) {
		for index, sibling := range siblings {
			if sibling.Folder != nil {
				folderPlaces[sibling.Folder.Id] = int64(index + 1)
				continue
			}
			requestPlaces[sibling.Request.Id] = int64(index + 1)
		}
	}
	for index := range folders {
		folders[index].SortOrder = folderPlaces[folders[index].Id]
	}
	for index := range requests {
		requests[index].SortOrder = requestPlaces[requests[index].Id]
	}
}

func (w *Workspace) sharedOrder() bool {
	root, err := w.readManifest()
	if err != nil {
		return false
	}
	var failure error
	return readFields(root, []string{sharedOrderKey}, &failure).flag(sharedOrderKey, false) && failure == nil
}

func (w *Workspace) MarkSharedOrder() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.markSharedOrder()
}

func (w *Workspace) markSharedOrder() error {
	if w.sharedOrder() {
		return nil
	}
	root, err := w.readManifest()
	if err != nil {
		return err
	}
	withoutKey(root, sharedOrderKey)
	setField(root, sharedOrderKey, flagNode(true))
	content, err := encodeDocument(root)
	if err != nil {
		return err
	}
	return w.disk.write(ManifestName, content)
}

func (w *Workspace) ShareOrder() error {
	collection := w.Collection()
	if collection.SharedOrder {
		return nil
	}
	ShareOrder(collection.Folders, collection.Requests)
	if err := w.SaveFolders(collection.Folders); err != nil {
		return err
	}
	if err := w.SaveRequests(collection.Requests); err != nil {
		return err
	}
	return w.MarkSharedOrder()
}
