package agent

import (
	"context"
	"time"

	"github.com/kunalgoesbyken/gostman/workspace"
)

type changesArguments struct {
	Since string `json:"since"`
	Mine  bool   `json:"mine"`
}

func (d *Desk) changes(_ context.Context, _ scene, arguments changesArguments) (workspace.ChangeFeed, error) {
	window, err := workspace.ParseChangeWindow(arguments.Since)
	if err != nil {
		return workspace.ChangeFeed{}, err
	}
	journal, err := d.files.Changes()
	if err != nil {
		return workspace.ChangeFeed{}, err
	}
	session := ""
	if arguments.Mine {
		session = d.session
	}
	return workspace.NewChangeFeed(workspace.RecentChanges(journal, window, time.Now(), session)), nil
}
