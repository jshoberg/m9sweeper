# m9sweeper Selenium Testing

We have configured m9sweeper to utilize the WebdriverIO testing utility combined with the Jasmine test framework in order to write functional tests for m9sweeper. This document covers the basics of the testing setup for m9sweeper.

<br>

## System Requirements:

In order to run m9sweeper tests you need to have a few things configured on your computer. This document will not cover the installation of these items, so please make sure you have them installed prior to running tests.

1. NodeJS @ v16 or above (we recommend using [nvm](https://github.com/nvm-sh/nvm) and this projects contains `.nvmrc` files for this purpose).
2. [minikube](https://minikube.sigs.k8s.io/docs/)
3. kubectl - This should be a version that supports the k8s version being used by minikube,
4. Helm - This should be a version that supports the k8s version being used by minikube.

<br>

## Project Structure Overview:

This project follows a specific folder structure for organizing tests. Any new tests should be sorted accoring to the existing structure with that structure being appended if new features are added that do not already exist. Below is a description of the test organization. One thing to note is that all tests have the name of the page it is testing followed by `spec.ts` to represent that it is a test spec.

### Core items:

- `wdio.shared.conf.ts`: This file contains the main configuration for the tests as well as some custom functions for things such as cust click or custom screenshot mechanisms that allow for screenshots to be created and named in a custom manner suiting our desires. This is also where all the test suites are defined.
- `wdio.pipeline.conf.ts`: This file contains overrides for the main configuration for usage in pipelines for testing in an environment where a browser window is not an option. This configures the browser to run in a headless mode.
- `wdio.local.conf.ts`: This file contains the overrides for the main configuration that allows a developer to run tests locally and allows the browser to run in a window so the developer can see the tests as they occur live.
- `package.json`: This is a standard NodeJS package file. This is also where we define the commands that NPM uses for running the tests. Any new test suites added need to have a new command registered here as well as the suite being defined in the wdio shared config described above.
- `.env`: This file does not exist by default, but can be created by the user by copying the `sample.env` file. This file can be used to configure environment variables for tests being run locally by the developer. This file is included in the projects gitignore file already so you do not need to worry about it being pushed out if you make a change and commit them. For a description of the enviroment variables see the section on running the tests below.

### Automatically Generated Folders:

During runtime of a test, there will be several folders generated automatically if they do not exist. If they already exist, it is recommended to delete them prior to running another test to avoid seeing data from other tests.

- `downloads`: This folder will contain any files that are downloaded as part of a test such as reports.
- `reports`: This folder will contain the JUnit test reports generated at the end of each test suite. At this time the result is named in a unfriendly manner similar to this: `results-0-0.chrome.xml`. The first digit represents the test suite, in most cases this will always be 0. The second digit represents the test number in the order it was ran according to how it is defined in the shared wdio config. Finally it will show the name of the browser the test was run within.
- `screenshots`: This folder will contain a subset of folders, with each sub-folder being that of a individual test that was run. In each sub-folder you will find all the screenshots generated by that particular test.

### The test folder:

This is the main folder that contains all the tests as well as custom functions used within the tests.

- `config.ts`: This is the configuration that is responsible for using environment variables to configure the tests or use a sensable default if one is not provided as a variable or in a .env file.
- `functions`: This folder contains an assortment of functions that are available to all the tests and should be used to hold anything that can be useful for multiple tests such as the login function.
- `specs`: This folder contains the actual tests. Inside this folder tests are sorted by their location of where they are in the UI (with the exception of the smoke tests folder). For example, installing Gatekeeper is done in the cluster page for a cluster, therfore the gatekeeper.spec.ts file is located within the cluster folder.

<br>

## Running Tests:

We have multiple test suites configured for m9sweeper in order to more efficiently run tests on specific portions of m9sweeper instead of simply running everything.

### Setting Configuration Options:

These tests allow you to configure several options that the test runner exposes to the test suites. All of these settings can be set in an .env file. If one is not provided, then the test will be run using the defaults that are set in the config.ts file as outlined above in this document. Below is a table of the possible variables and their descritions as well as their defaults:

| **<u>Variable</u>**  |                    **<u>Description</u>**                    |   **<u>Default Value</u>**    |
| :------------------: | :----------------------------------------------------------: | :---------------------------: |
|       USERNAME       | This is the username that the tests will use when logging into the m9sweeper dashboard. | `super.admin@intellative.com` |
|       PASSWORD       | This is the password that the tests will use when logging into the m9sweeper dashboard. |           `123456`            |
|       BASE_URL       | This is the full url (including port and protocol) that the m9sweeper dashboard is available on. |    `http://127.0.0.1:3000`    |
|  GATEKEEPER_VERSION  |        This is the version of gatekeeper to install.         |           `3.10.0`            |
|   DOCKER_REGISTRY    | Used if you need to use a proxy registry such as Nexus to avoid rate limits for pulling from DockerHub. This should be a registry that allows anynomous pulls. |                               |
| SKIP_GATEKEEPER_TEST | This will skip the gatekeeper tests if set to `true`. If not defined or set to `false` the tests will be run as normal. This is mainly used in the pipeline for testing older versions of k8s (<=1.17.x) where gatekeeper installs are potentially broken and not supported by m9sweeper. |            `false`            |

### Preparing to Run:

1. Make sure you have the system requirements outlined above installed on your system. 

2. Configure the test settings if needed through environment variables or by creating a .env file. Referr to the above table to available configuration options.

3. Clone the m9sweeper directory if you have not already and move into the selenium-testing folder in your command line.

4. Install all the dependencies for the project by running the `npm install` command.

5. Setup a Kubernetes cluster with Minikube:
   ```shell
   minikube start --kubernetes-version 1.27.1
   ```

6. Install m9sweeper using Helm, please refer to the m9sweeper docs on customizing this. Make sure that your dash.init.docker.registries section contains all the registry information for images being used in the cluster, this is important in order for tests to succeed.
   ```shell
   helm upgrade m9sweeper m9sweeper/m9sweeper --install --wait --create-namespace --namespace m9sweeper-system \
       --set-string dash.init.superAdminEmail="super.admin@intelletive.com" \
       --set-string dash.init.superAdminPassword="123456" \
       --set-string global.apiKey="myapikey123456" \
       --set-string global.jwtSecret=testsecret \
       --set-string 'dash.init.docker.registries[0]'.name="Dockerhub" \
       --set-string 'dash.init.docker.registries[0]'.hostname="docker.io" \
       --set-string 'dash.init.docker.registries[0]'.login_required=false \
       --set-string 'dash.init.docker.registries[0]'.'aliases[0]'="index.docker.io" \
       --set-string 'dash.init.docker.registries[1]'.name="Kubernetes Container Registry" \
       --set-string 'dash.init.docker.registries[1]'.hostname="k8s.gcr.io" \
       --set-string 'dash.init.docker.registries[1]'.login_required=false \
       --set-string 'dash.init.docker.registries[2]'.name="Google Container Registry" \
       --set-string 'dash.init.docker.registries[2]'.hostname="us.gcr.io" \
       --set-string 'dash.init.docker.registries[2]'.login_required=false \
       --set-string 'dash.init.docker.registries[3]'.name="Microsoft Container Registry" \
       --set-string 'dash.init.docker.registries[3]'.hostname="mcr.microsoft.com" \
       --set-string 'dash.init.docker.registries[3]'.login_required=false \
       --set-string 'dash.init.docker.registries[4]'.name="Github Container Registry" \
       --set-string 'dash.init.docker.registries[4]'.hostname="ghcr.io" \
       --set-string 'dash.init.docker.registries[4]'.login_required=false
   ```

   NOTE: If you are using a docker proxy repository you will also want to set the following environment variables and changing the registry domain to your domain:
   ```shell
       --set-string rabbitmq.image.repository="<YOUR_REGISTRY_URL_HERE>/rabbitmq" \
       --set-string postgresql.image.repository="<YOUR_REGISTRY_URL_HERE>/postgres" \
       --set-string postgresql.volumePermissions.image.repository="<YOUR_REGISTRY_URL_HERE>/debian" \
       --set-string dash.kubesec.registry="<YOUR_REGISTRY_URL_HERE>"
   ```

7. Configure a port-forwarding from the minikube cluster to your machine so you and the tests can access the m9sweeper dashboard:
   ```shell
   kubectl port-forward service/m9sweeper-dash 3000:3000 -n m9sweeper-system
   ```

### Running Tests:

In order to run the tests you should have a command line window open to the selenium-testing folder. From there you will utilize the npm run command to run a test script that is defined in the package.json file. Currently there are 4 main items configured, 3 of which are useful when testing locally. 

- `npm run test:all`: This command will initalize a test session that will run all configured tests.
- `npm run test:cluster`: This command will initalize a test session that will run all the tests under the cluster folder.
- `npm run test:orginization`: This command will initalize a test session that will run all the tests under the organization folder.
- `npm run test:pipeline`: This is the command used by the pipelines to run a test in an environment where the browser needs to be run in a headless mode. It can be used locally but we advise you to use the `npm run test:all` command instead.

In addition to the preconfigured test suites, you can also run an individual test using the following command and replacing the `<TEST_SPEC_PATH>` in the following command. Please note that this works on macOS and Linux systems only. If you are on windows you will need to define a new script in the package.json file and call that script name instead.
```shell
npm run env -- wdio run wdio.local.conf.ts --spec <TEST_SPEC_PATH>
```