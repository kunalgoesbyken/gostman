package workspace

import "github.com/kunalgoesbyken/gostman/engine"

func BlankRequest(id string) Request {
	return Request{Id: id, Auth: engine.Auth{OAuth2: engine.OAuth2{Grant: defaultGrant, PKCE: true}}}
}
