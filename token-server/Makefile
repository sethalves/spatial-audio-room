
GO=go

all: token-server

token-server: server.go
	${GO} build -o $@ .

clean:
	rm -f *~ token-server
