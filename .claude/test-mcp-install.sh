#!/bin/bash

echo "Starting installation..."

install_mcp() {
    local name=$1
    echo "Installing $name"
    return
}

echo "About to call function 1"
install_mcp "test1"
echo "After function 1"

echo "About to call function 2"  
install_mcp "test2"
echo "After function 2"

echo "Script finished"