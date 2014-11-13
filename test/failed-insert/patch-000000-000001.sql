-- Create the 'metadata' table.
-- Note: This should be the only thing in this initial patch.

CREATE TABLE failed_insert (
  name VARCHAR(255) NOT NULL PRIMARY KEY,
  value VARCHAR(255) NOT NULL
) ENGINE=InnoDB;

-- Not doing this, so that the check fails.
-- INSERT INTO failed_insert SET name = 'schema-patch-level', value = '1';
