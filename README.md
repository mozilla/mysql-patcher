# mysql-patcher #

A package/program to help patch MySql databases.




## .patch(options) ##

Options:

* createDatabase :


* upgrade : true/false - Useful to set to false if no patch (default: true)

### General MySql Options ###

If any of the following are provided they are passed through to the mysql connection options. If they are not provided, they will
take the [default mentioned](https://www.npmjs.org/package/mysql) here:

* host
* port
* user
* password
* database
* charset

### createDatabase ###

* Type: Boolean (true/false)
* Default: false

Determines whether to try to create the database if it does not exist. Since only one set of credentials are allowed,
then the credentials given must have the MySql permissions required to create the database. Because of this, this
option is generally only useful in development.

### user ###

* Type: String
* No Default

The username of the database user to connect as.

(Ends)
