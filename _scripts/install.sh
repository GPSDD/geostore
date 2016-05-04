#!/bin/bash
set -x # Show the output of the following commands (useful for debugging)

ssh-keyscan -H $DEPLOY_HOST >> $HOME/.ssh/known_hosts
# Import the SSH deployment key
openssl aes-256-cbc -K $encrypted_0f765e1d606f_key -iv $encrypted_0f765e1d606f_iv -in deploy-key.enc -out deploy-key -d
rm deploy-key.enc # Don't need it anymore
chmod 600 deploy-key
mv deploy-key ~/.ssh/id_rsa
