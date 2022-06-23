
GO=go

all: bot-controller

bot-controller: bot-controller.go
	${GO} build -o $@ .

clean:
	rm -f *~ bot-controller
