#!/usr/local/bin/fish

jscad -v bricks.js;

if [ (shasum bricks.stl) = "cfd1e49e42ffb64d93a14eec63cd0b5340afd73d  bricks.stl" ]
  echo "test passed"
else
  echo "test failed"
end
