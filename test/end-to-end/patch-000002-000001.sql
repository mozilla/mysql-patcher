DROP TABLE accounts;

UPDATE dbMetadata SET value = '1' WHERE name = 'schema-patch-level';
