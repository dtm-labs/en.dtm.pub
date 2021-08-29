# Database Interface

## Overview

The subtransaction barrier in dtm needs to interact with the database.
The xa transaction mode also needs to interact with the database. 
The interaction interface currently defined by dtm is compatible with the standard sql library.
Therefore, when developing using dtm, you can directly pass sql.DB/sql.Tx.

Most of the projects in practice use more advanced orm libraries, such as gorm and ent, etc. 
For such usage, interface adaptation is required.

In order to keep the dependencies of dtm as small as possible, the example of dtm is given only for gorm.
For other orms, the usage will be explained in the documentation.

## GORM

Examples in examples/http_saga_gorm_barrier|http_gorm_xa

barrier example.
``` go
  barrier := MustBarrierFromGin(c)
  // Manually open the transaction
  tx := dbGet().DB.Begin()
	return dtmcli.ResultSuccess, barrier.Call(tx.Statement.ConnPool.(*sql.Tx), func(db dtmcli.DB) error {
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

## GOQU

barrier example.
``` go
	dialect := goqu.Dialect("mysql")
	sdb, err := dbGet().DB.DB()
	if err ! = nil {
		return nil, err
	}
	tx, err := dialect.DB(sdb).Begin()
	return dtmcli.ResultSuccess, barrier.Call(tx, func(db dtmcli.DB) error {
		_, err := tx.Exec("update dtm_busi.user_account set balance = balance + ? where user_id = ?" , -req.Amount, 2)
		return err
	})
```

xa example

``` go
  return XaClient.XaLocalTransaction(c.Request.URL.Query(), func(db *sql.DB, xa *dtmcli.Xa) (interface{}, error) {
    dialect := goqu.Dialect("mysql")
    godb := dialect.DB(db)
    _, err := godb.Exec("update dtm_busi.user_account set balance=balance-? where user_id=?" , reqFrom(c).Amount, 1)
    return dtmcli.ResultSuccess, err
  })
```

## XORM

Please note that the pr was just raised to xorm on 2021-08-21, exposing sql.Tx, which has been merged but not yet released version, so you need to install the latest version

``` bash
go get -u xorm.io/xorm@7cd6a74c9f
```

barrier example.

``` go
	x, _ := xorm.NewEngineWithDB("mysql", "dtm", core.FromDB(sdbGet()))
	se := x.NewSession()
	defer se.Close()
	err := se.
	if err ! = nil {
		return nil, err
	}
	return dtmcli.ResultSuccess, barrier.Call(se.Tx().Tx, func(db dtmcli.DB) error {
		_, err := se.Exec("update dtm_busi.user_account set balance = balance + ? where user_id = ?" , -req.Amount, 2)
		return err
	})
```

xa example

``` go
  return XaClient.XaLocalTransaction(c.Request.URL.Query(), func(db *sql.DB, xa *dtmcli.Xa) (interface{}, error) {
    xdb, _ := xorm.NewEngineWithDB("mysql", "dtm", core.FromDB(db))
    _, err := xdb.Exec("update dtm_busi.user_account set balance=balance-? where user_id=?" , reqFrom(c).Amount, 1)
    return dtmcli.ResultSuccess, err
  })

```
