# Additional functional features
Most of the functional features have been described in detail in the relevant documentation, the following will introduce additional functional features

## Authentication
For many companies' api, authentication is usually required, most authentication systems carry token through http/grpc header, dtm supports global transaction-wide header customization, for details, please refer to [transaction options](./options) in the custom header section

## Single Service Multiple DB
Some application services, will access multiple data sources, when they form a global transaction, you need to do multiple data source transactions, either all successful, or all rollback. Most distributed transaction frameworks do not provide this support, but dtm can support it with a simple trick

Assuming that you don't need to cross services when transferring across rows, but only need to modify data across databases, you can merge two transaction branches into a single transaction branch and then manipulate data across data sources within a single service.

``` go
app.POST(BusiAPI+"/SagaMultiSource", dtmutil.WrapHandler2(func(c *gin.Context) interface{} {
  barrier := MustBarrierFromGin(c)
  transOutSource := pdbGet() // data source 1
  err := barrier.CallWithDB(transOutSource, func(tx *sql.Tx) error {
    return SagaAdjustBalance(tx, TransOutUID, -reqFrom(c).Amount, reqFrom(c).TransOutResult)
  })
  if err ! = nil {
    return err
  }
  transInSource := pdbGet() // data source 2
  return MustBarrierFromGin(c).CallWithDB(transInSource, func(tx *sql.Tx) error {
    return SagaAdjustBalance(tx, TransInUID, reqFrom(c).Amount, reqFrom(c).TransInResult)
  })
}))
app.POST(BusiAPI+"/SagaMultiSourceRevert", dtmutil.WrapHandler2(func(c *gin.Context) interface{} {
  barrier := MustBarrierFromGin(c)
  transInSource := pdbGet() // data source2
  err := MustBarrierFromGin(c).CallWithDB(transInSource, func(tx *sql.Tx) error {
    return SagaAdjustBalance(tx, TransInUID, -reqFrom(c).Amount, "")
  })
  if err ! = nil {
    return err
  }
  transOutSource := pdbGet() // data source 1
  return barrier.CallWithDB(transOutSource, func(tx *sql.Tx) error {
    return SagaAdjustBalance(tx, TransOutUID, +reqFrom(c).Amount, "")
  })
}))

saga := dtmcli.NewSaga(dtmutil.DefaultHTTPServer, dtmcli.MustGenGid(dtmutil.DefaultHTTPServer)).
  Add(busi.Busi+"/SagaMultiSource", busi.Busi+"/SagaMultiSourceRevert", req)

```

The above code ensures that data modifications to DataSource 1 and DataSource 2 will either all succeed or all be rolled back, in spite of various exceptions.

For a runnable example, see `multiSource` in [dtm-examples](https://github.com/dtm-labs/dtm-examples)