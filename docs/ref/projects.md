## Project Overview

## dtm-labs Organization
The main goal of [dtm-labs](https://github.com/dtm-labs) is to make distributed transactions easier, and contains various projects related to dtm
- main repo dtm: dtm server, covering dtm source code, unit tests, http client, gRPC client
- dtm-examples: contains examples of various dtm transaction modes, and the use of various options
- dtm.pub and en.dtm.pub: documentation, including the Chinese dtm.pub and English en.dtm.pub documentation
- dtmcli and dtmgrpc: the code of these two repo is synchronized from the dtmcli and dtmgrpc directories in the dtm project
- dtmcli-go-sample and dtmgrpc-go-sample: these two examples mainly demonstrate the minimal examples of dtmcli and dtmgrpc
- dtmcli-xxx: Other language clients for dtm
- dtmcli-xxx-sample: Other language examples for dtm

## Main project dtm

The dtm project has the following main directories

- bench: the server code for performance testing, and the related test scripts
- dtmcli: The http client for dtm, which is synced to dtm-labs/dtmcli during release
- dtmgrpc: dtm's grpc client, synced to dtm-labs/dtmgrpc when publishing
- dtmsvr: server side of dtm, including http and grpc services
- dtmutil: the tool class used by dtm, will be used in dtmsvr and test
- helper: all kinds of helper files
- qs: quick-start examples
- sqls: contains the sql used by dtm
- test: contains various test cases

#### Error handling
The Go language recommends error handling in the form of error is a value, not an exception, so the interfaces provided in dtmcli for users to use are in line with this standard.

However, the example given uses the function E2P, which is a custom function that turns error into a panic, which does not conform to the Go specification, but reduces the amount of error handling code and makes the posted code shorter, allowing the user to focus on the core demo content

Go's error handling, a lot `if err ! = nil { return err }`, resulting in a lot of inelegant code, so dtm is temporarily using panic/cover as a way to handle uncommon errors. future versions of Go's error-handling will introduce elegant check/handle to solve this problem completely. At that time, dtm will refactor the error-handling part to match the new error-handling approach.

## How to read dtm source code
If you need to read the source code of DTM, the recommended way is
- dtm home README, run a quick-start, understand the dtm a distributed transaction process
- Read the documentation in dtm.pub to understand the theory and transactions, and run the examples with dtm-labs/dtm-examples
- Go to test of dtm project, run test cases of interest, and trace and debug dtm SDK and server code with test cases
