Package.describe({
  name   : 'happyuc:accounts',
  summary: 'Provides and updates the happyuc accounts in the Accounts collection',
  version: '1.1.5',
  git    : 'http://github.com/happyuc-project/meteor-package-accounts',
});

Package.onUse(function(api) {
  api.versionsFrom('1.0');
  api.use('underscore', ['client', 'server']);
  api.use('mongo', ['client', 'server']);
  api.use('frozeman:persistent-minimongo@0.1.8', 'client');
  api.use('happyuc:webu@1.0.5', ['client', 'server']);

  api.export(['HucAccounts'], ['client', 'server']);

  api.addFiles('accounts.js', ['client', 'server']);
});

