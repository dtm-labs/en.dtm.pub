# Direct deployment

## Get binaries

dtm does not support direct installation by apt/yum/brew.
You need to compile the binaries through go environment, so it is not recommended to deploy this way.

## Compile

You need to have a go 1.15 or higher environment to compile the binaries with the following command
```
go build -o dtm app/main.go
```

## Configuration

You can set the relevant environment variables (see [Deployment Basics](./base)), or you can create a conf.yml file in your working directory, referring to [configuration sample file](https://github.com/yedf/dtm/blob/main/conf.sample.yml)

## Start

dtm will listen to port 8080

```
./dtm dtmsvr
```
