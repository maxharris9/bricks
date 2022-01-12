#!/usr/local/bin/fish

jscad -v bricks.js;

if [ (shasum bricks.stl) = "254f729961bf893a72ef3a721417c33594bbc43a  bricks.stl" ]
  echo "test passed"
else
  echo "test failed"
end
