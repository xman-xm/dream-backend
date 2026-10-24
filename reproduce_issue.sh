#!/bin/bash
# Reproduce the JSON syntax error by sending invalid JSON
curl -X POST http://localhost:3000/api/auth/mobile/login \
  -H "Content-Type: application/json" \
  -d '{ key: "value" }' -v
