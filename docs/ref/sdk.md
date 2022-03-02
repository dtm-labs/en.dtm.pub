# SDK

## Supported languages

#### go

Both dtmcli and dtmgrpc here are copies of the contents inside the dtm project. Using the packages here, instead of dtm, will give your application fewer dependencies and smaller packages

http sdk: [https://github.com/dtm-labs/dtmcli](https://github.com/dtm-labs/dtmcli)

Minimalist example: [https://github.com/dtm-labs/dtmcli-go-sample](https://github.com/dtm-labs/dtmcli-go-sample)

grpc sdk: [https://github.com/dtm-labs/dtmgrpc](https://github.com/dtm-labs/dtmgrpc)

Minimal example: [https://github.com/dtm-labs/dtmgrpc-go-sample](https://github.com/dtm-labs/dtmgrpc-go-sample)

The most complete examples of SDK usage, including grpc/http/xa/msg/saga/tcc/barrier, etc., are combined in the following project

[https://github.com/dtm-labs/dtm-examples](https://github.com/dtm-labs/dtm-examples)

#### php
Client sdk concurrent version (supports Hyperf, SAGA, TCC, MSG, subtransaction barriers) [https://github.com/dtm-php/dtm-client](https://github.com/dtm-php/dtm-client)

Example: [https://github.com/dtm-php/dtm-sample](https://github.com/dtm-php/dtm-sample)

The above SDK is personally operated by [Huang Chaohui](https://github.com/huangzhhui), a famous coder in PHP, and recommended by the founder of Swool, with high code quality and active community

Common client sdk (currently only support TCC): [https://github.com/dtm-labs/dtmcli-php](https://github.com/dtm-labs/dtmcli-php)

Example: [https://github.com/dtm-labs/dtmcli-php-sample](https://github.com/dtm-labs/dtmcli-php-sample)

Thanks to [onlyshow](https://github.com/onlyshow) for help with the php sdk and examples, mainly done by him

#### dotnet

Client sdk http version (supports TCC, SAGA, MSG, subtransaction barriers): [https://github.com/dtm-labs/dtmcli-csharp](https://github.com/dtm-labs/dtmcli-csharp)

Example: [https://github.com/dtm-labs/dtmcli-csharp-sample](https://github.com/dtm-labs/dtmcli-csharp-sample)

Thanks to [catcherwong](https://github.com/catcherwong), [geffzhang](https://github.com/geffzhang) for their help with the C sdk and examples, mainly contributed by them

Client-side sdk grpc version: [https://github.com/catcherwong/dtmgrpc-csharp](https://github.com/catcherwong/dtmgrpc-csharp)

#### python

Client sdk (currently supports TCC, SAGA, subtransaction barriers): [https://github.com/dtm-labs/dtmcli-py](https://github.com/dtm-labs/dtmcli-py)

Example: [https://github.com/dtm-labs/dtmcli-py-sample](https://github.com/dtm-labs/dtmcli-py-sample)


#### Java

Client sdk (TCC, subtransaction barrier): [https://github.com/dtm-labs/dtmcli-java](https://github.com/dtm-labs/dtmcli-java)

Example: [https://github.com/dtm-labs/dtmcli-java-sample](https://github.com/dtm-labs/dtmcli-java-sample)

Thanks to [li-xiao-shuang](https://github.com/li-xiao-shuang), [viticis](https://github.com/viticis) for their help with the Java sdk and examples, mainly contributed by them

#### node

Client sdk (currently only supports TCC): [https://github.com/dtm-labs/dtmcli-node](https://github.com/dtm-labs/dtmcli-node)

Example: [https://github.com/dtm-labs/dtmcli-node-sample](https://github.com/dtm-labs/dtmcli-node-sample)

#### Other

If you don't find a language you are familiar with here, and you want to run dtm to see what a distributed transaction looks like, you can refer here.

[DTM installation and operation](../guide/install)

If you are installing via brew, then you can just run

```
dtm-qs
```

The above dtm-qs command will run a simple quick start example, which is a saga transaction, you can compare the saga timing diagram and logs to get a deeper understanding of dtm

## Supported databases
The SDK of dtm provides subtransaction barrier function and also provides XA related support, this part of the support is related to the specific database. Currently several common database transactions are supported, including Mysql series, Postgres, Redis, Mongo and more database transactions will be considered for access in the future
#### Mysql series

including Mysql, MariaDB, TiDB, TDSQL

#### Postgres

Postgres is fully supported, if you use Postgres, you need to make the following calls before using the SDK

``` go
dtmcli.SetCurrentDBType("postgres")
```

For a detailed example, you can refer to the code in dtm/app/main.go

#### Redis
DTM has supported Redis transactions, so that users can use a combination of Redis and Mysql in a distributed transaction, you can put the deducted inventory in Redis, to provide accurate deducted inventory architecture, so that the order system can easily cope with the spike scenario

#### Mongo
DTM has supported Mongo
## ORM access {#orm}

#### Overview

The subtransaction barrier in dtm, which requires interaction with the database, and the xa transaction model, which also requires interaction with the database. The current interaction interface defined by dtm adopts a standard library sql compatible way, users can pass sql.DB/sql.Tx directly.

Because the barrier needs to manipulate the barrier-related tables inside the transaction, its interface needs to be passed a *sql.Tx or *sql.

``` go
func (bb *BranchBarrier) Call(tx *sql.Tx, busiCall BusiFunc) error
func (bb *BranchBarrier) CallWithDB(db *sql.DB, busiCall BusiFunc) error

```

In Xa transaction mode, the local database connection is created and managed by dtmcli, so the argument type for calling the callback function is *sql.DB . If you are using another library, such as gorm, then you can just build the relevant orm object based on *sql.DB.

``` go
type XaLocalFunc func(db *sql.DB, xa *Xa) (interface{}, error)
```

The current dtm example, only shows how to use gorm. Other orm's access is only described here.

#### GORM

Example in [dtm-examples](https://github.com/dtm-labs/dtm-examples)

barrier example.
``` go
  barrier := MustBarrierFromGin(c)
  // gdb is a *gorm.DB
  tx := gdb.Begin()
	return dtmcli.ResultSuccess, barrier.Call(tx.Statement.ConnPool.(*sql.Tx), func(tx1 *sql.Tx) error {
		return tx.Exec("update dtm_busi.user_account set balance = balance + ? where user_id = ?" , -req.Amount, 2).Error
	})
```

xa Example.

``` go
  return XaClient.XaLocalTransaction(c.Request.URL.Query(), func(db *sql.DB, xa *dtmcli.Xa) (interface{}, error) {
    // gorm provides an interface to construct gorm.DB from the standard sql.
    gdb, err := gorm.Open(mysql.New(mysql.Config{
      Conn: db,
    }), &gorm.Config{})
    if err ! = nil {
      return nil, err
    }
    dbr := gdb.Exec("update dtm_busi.user_account set balance=balance-? where user_id=?" , reqFrom(c).Amount, 1)
    return dtmcli.ResultSuccess, dbr.Error
  })
```

#### GOQU

Example of a barrier.
``` go
	dialect := goqu.Dialect("mysql")
	sdb, err := dbGet().DB.DB()
	if err ! = nil {
		return nil, err
  }
  gdb := dialect.DB(sdb)
  // gdb is goqu dialect.DB, the following code shows how to get tx
	tx, err := gdb.Begin()
	return dtmcli.ResultSuccess, barrier.Call(tx, func(tx1 *sql.Tx) error {
		_, err := tx.Exec("update dtm_busi.user_account set balance = balance + ? where user_id = ? ", -req.Amount, 2)
		Return err
	})
```

xa example

```Go to
  return XaClient.XaLocalTransaction(c.Request.URL.Query(), func(db *sql.DB, xa *dtmcli.Xa) (interface{}, error) {
    dialect := goqu.Dialect("mysql")
    godb := dialect.DB(db)
    _, err := godb.Exec("update dtm_busi.user_account set balance=balance-? where user_id=?" , reqFrom(c).Amount, 1)
    return dtmcli.ResultSuccess, err
  })
```

#### XORM

Example of an barrier.

``` go
	x, _ := xorm.NewEngineWithDB("mysql", "dtm", core.FromDB(sdbGet()) )
	se := x.NewSession()
	defer se.Close()
	err := se.Begin()
	if err ! = nil {
		return nil, err
	}
  // se is an xorm session, the following code shows how to get tx
	return dtmcli.ResultSuccess, barrier.Call(se.Tx().Tx, func(tx1 *sql.Tx) error {
		_, err := se.Exec("update dtm_busi.user_account set balance = balance + ? where user_id = ? ", -req.Amount, 2)
		Return err
	})
```

xa example

```Go to
  return XaClient.XaLocalTransaction(c.Request.URL.Query(), func(db *sql.DB, xa *dtmcli.Xa) (interface{}, error) {
    xdb, _ := xorm.NewEngineWithDB("mysql", "dtm", core.FromDB(db))
    _, err := xdb.Exec("update dtm_busi.user_account set balance=balance-? where user_id=?" , reqFrom(c).Amount, 1)
    return dtmcli.ResultSuccess, err
  })

```

#### go-zero
Example of a barrier.

``` go
  // Assuming conn is sqlx.SqlConn inside go-zero
  db, err := conn.RawDB()
  if err ! = nil {
    return err
  }
	return dtmcli.ResultSuccess, barrier.CallWithDB(db, func(tx *sql.Tx) error {
		_, err := tx.Exec("update dtm_busi.user_account set balance = balance + ? where user_id = ? ", -req.Amount, 2)
		Return err
	})
```

xa example

```Go to
  return XaClient.XaLocalTransaction(c.Request.URL.Query(), func(db *sql.DB, xa *dtmcli.Xa) (interface{}, error) {
    conn := NewSqlConnFromDB(db)
    _, err := conn.Exec("update dtm_busi.user_account set balance=balance-? where user_id=?" , reqFrom(c).Amount, 1)
    return dtmcli.ResultSuccess, err
  })

```

#### ent
Can be supported, code example to be added