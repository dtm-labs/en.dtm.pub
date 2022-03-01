# DTM development test guide
This article is intended for developers who contribute to dtm, or for developers who are ready to debug dtm. Ordinary developers who just want to access dtm do not need to pay attention to the content of this article.

## Basic Environment
The dtm project needs to store data in mysql|redis|postgres, so you need to prepare the relevant server.

It is recommended to use docker-compose to prepare the environment, you can install docker 20.04 or above, and then in the dtm project path, execute
`docker-compose -f helper/compose.store.yml`

## Add test cases
This step is optional, but for bugs or new features, it is highly recommended that you add test cases so that every future change does not reintroduce the problem you have solved

You can refer to the existing test cases and add your new cases where appropriate. The existing use cases are relatively comprehensive, with all kinds of normal/abnormal cases covered, and the whole test coverage can reach 95%.

## Modify the problem
If you have already added a test case, then first make sure the test case is failing before you modify it

You make relevant code modifications for the problem, try to make the code simple and clear so that others can easily read and understand it, and add comments for complex/strange logic

## Test after modification

After you finish modifying the relevant problem, you can run the relevant test cases by go test to confirm that you have solved the relevant problem, and then run all the test cases again to make sure that your new code has not introduced new problems

dtm has no testers, and its stability is mainly ensured by automated testing. We have high requirements on test coverage, after version 1.0, we require a coverage rate of 95%+.

** Attention!!! ** After you finish your changes, please make sure the following command shows that all test cases have passed

`go test . /... `

If your changes involve the storage engine part, then you need to set the environment variables to override the test cases under the specific engine

```
go test . /... # By default, the redis engine is used
TEST_STORE=redis go test . /... # Test the redis engine
TEST_STORE=boltdb go test . /... # Test the boltdb engine
TEST_STORE=mysql go test . /... # Test the mysql engine
TEST_STORE=postgres go test . /... # Test the postgres engine
```

## Initiate a PR
Once your changes are complete, follow the process to initiate a PR, and then focus on the following

- Whether your PR passes all of dtm's integration tests
- If you add new code, keep an eye on your code [test coverage](https://coveralls.io/github/dtm-labs/dtm)

For PRs that pass the above two items, dtm staff will give you feedback as soon as possible, and if there are no major issues, your PR will be merged