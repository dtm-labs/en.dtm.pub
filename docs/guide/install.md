# Installation

DTM is comprised of two parts, the service and the client SDK.
Let's look at the service installation first.

## Installation via MAC Homebrew

```
brew install dtm
```

You can start dtm use following command

```
dtm
```

## Installation via go

This way of installation is very friendly for developers who would like to study dtm in depth using go language.
It is easy for developers to run all the examples, and debug and trace the running of all the code.

#### Preparation

First you need to [install go 1.15+](https://golang.google.cn/)

Then run the following command

``` bash
git clone https://github.com/dtm-labs/dtm
cd dtm
```

#### start

You can start dtm server by following command:

``` bash
go run main.go
```

You can start a quick start distributed transaction by following command:

``` bash
go run qs/main.go
```

## Installation via binaries

You can download dtm binaries from [here](https://github.com/dtm-labs/dtm/releases/latest).

you can run the bianry after you unzip the package.
