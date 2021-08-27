# Installation

DTM is comprised of two parts, the service and the client SDK.
Let's look at the service installation first.

## Installation via docker  

This way of installation is very friendly for other language stacks to start DTM.

You first need to [install docker 18+](https://docs.docker.com/get-docker/)

Then run the following command

``` bash
git clone https://github.com/yedf/dtm
cd dtm
docker-compose up
```

## Installation via go 

This way of installation is very friendly for developers who would like to study dtm in depth using go language.
It is easy for developers to run all the examples, and debug and trace the running of all the code.

### Preparation

First you need to [install go 1.15+](https://golang.google.cn/)

Then run the following command

``` bash
git clone https://github.com/yedf/dtm
cd dtm
```

dtm depends on mysql and you can install it in one of the following two ways:

### Manually install mysql (optional)

Manually [install mysql](https://www.mysql.com/)

Fill in mysql related configuration

``` bash
cp conf.sample.yml conf.yml # Modify conf.yml
```

### docker install mysql (optional)

You first need to [install docker 18+](https://docs.docker.com/get-docker/)

Then run the following command

``` bash
docker-compose -f aux/compose.mysql.yml up
```

### start

The most common is to prepare the data and start

``` bash
go run app/main.go
```

You can also prepare the data, start and run a saga example

``` bash
go run app/main.go saga
```

You can also just start it without preparing data

``` bash
go run app/main.go dtmsvr
```
