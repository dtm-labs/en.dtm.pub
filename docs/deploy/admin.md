# Console

dtm From v1.14.0 onwards, a console has been added, which you can access via port 36789 and, in the case of local startup, the URL
`http://localhost:36789`

* If you download the pre-compiled binary file, or the official docker image, then dtm is already pre-compiled with the console
* If you start dtm from source code, then dtm will proxy access to the admin backend to the dtm site if the console is not compiled and packaged, so access may be slightly slower

## Features
* Global transaction list
  - Some global transactions may be duplicated under the redis engine, see [Redis' Scan command](https://redis.io/commands/scan/) for details.
* Global transaction details
