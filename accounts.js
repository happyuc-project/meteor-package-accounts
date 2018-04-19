/**

 @module Happyuc:accounts
 */

/**
 The accounts collection, with some happyuc additions.

 @class HucAccounts
 @constructor
 */
var collection = new Mongo.Collection('happyuc_accounts', {connection: null});
HucAccounts = _.clone(collection);
HucAccounts._collection = collection;

if (typeof PersistentMinimongo !== 'undefined') new PersistentMinimongo(HucAccounts._collection);

/**
 Updates the accounts balances, by watching for new blocks and checking the balance.

 @method _watchBalance
 */
HucAccounts._watchBalance = function() {
  var _this = this;

  if (this.blockSubscription) this.blockSubscription.stopWatching();

  // UPDATE SIMPLE ACCOUNTS balance on each new block
  this.blockSubscription = webu.huc.filter('latest');
  this.blockSubscription.watch(function(e, res) {
    if (!e) _this._updateBalance();
  });
};

/**
 Updates the accounts balances.

 @method _updateBalance
 */
HucAccounts._updateBalance = function() {
  var _this = this;

  _.each(HucAccounts.find({}).fetch(), function(account) {
    webu.huc.getBalance(account.address, function(err, res) {
      if (!err) {
        if (res.toFixed) res = res.toFixed();
        HucAccounts.update(account._id, {$set: {balance: res}});
      }
    });
  });
};

/**
 Updates the accounts list,
 if its finds a difference between the accounts in the collection and the accounts in the accounts array.

 @method _addAccounts
 */
HucAccounts._addAccounts = function() {
  var _this = this;

  // UPDATE normal accounts on start
  webu.huc.getAccounts(function(e, accounts) {
    if (!e) {
      var visibleAccounts = _.pluck(HucAccounts.find().fetch(), 'address');

      if (
          !_.isEmpty(accounts) &&
          _.difference(accounts, visibleAccounts).length === 0 &&
          _.difference(visibleAccounts, accounts).length === 0
      ) return;

      var localAccounts = HucAccounts.findAll().fetch();

      // if the accounts are different, update the local ones
      _.each(localAccounts, function(account) {
        // needs to have the balance
        if (!account.balance) return;

        // set status deactivated, if it seem to be gone
        if (!_.contains(accounts, account.address)) {
          HucAccounts.updateAll(account._id, {$set: {deactivated: true}});
        }
        else {
          HucAccounts.updateAll(account._id, {$unset: {deactivated: ''}});
        }

        accounts = _.without(accounts, account.address);
      });

      // ADD missing accounts
      var accountsCount = visibleAccounts.length + 1;
      _.each(accounts, function(address) {
        webu.huc.getBalance(address, function(e, balance) {
          if (!e) {
            if (balance.toFixed) balance = balance.toFixed();

            webu.huc.getCoinbase(function(error, coinbase) {
              if (error) {
                console.warn('getCoinbase error: ', error);
                coinbase = null; // continue with null coinbase
              }

              var doc = HucAccounts.findAll({address: address}).fetch()[0];

              var insert = {
                type: 'account',
                address: address,
                balance: balance,
                name: address === coinbase ? 'Main account (Coinbase)' : 'Account ' + accountsCount,
              };

              if (doc) {
                HucAccounts.updateAll(doc._id, {$set: insert});
              } else {
                HucAccounts.insert(insert);
              }

              if (address !== coinbase) accountsCount++;
            });
          }
        });
      });
    }
  });
};

/**
 Builds the query with the addition of "{deactivated: {$exists: false}}"

 @method _addToQuery
 @param args
 @param {Object} options
 @param {Object} options.includeDeactivated If set then de-activated accounts are also included.
 @return {Object} The query
 */
HucAccounts._addToQuery = function(args, options) {
  var _this = this;
  options = _.extend({includeDeactivated: false}, options);

  var args = Array.prototype.slice.call(args);

  if (_.isString(args[0])) {
    args[0] = {_id: args[0]};
  } else if (!_.isObject(args[0])) {
    args[0] = {};
  }

  if (!options.includeDeactivated) {
    args[0] = _.extend(args[0], {deactivated: {$exists: false}});
  }

  return args;
};

/**
 Find all accounts, besides the deactivated ones

 @method find
 @return {Object} cursor
 */
HucAccounts.find = function() {
  return this._collection.find.apply(this, this._addToQuery(arguments));
};

/**
 Find all accounts, including the deactivated ones

 @method findAll
 @return {Object} cursor
 */
HucAccounts.findAll = function() {
  return this._collection.find.apply(this, this._addToQuery(arguments, {includeDeactivated: true}));
};

/**
 Find one accounts, besides the deactivated ones

 @method findOne
 @return {Object} cursor
 */
HucAccounts.findOne = function() {
  return this._collection.findOne.apply(this, this._addToQuery(arguments));
};

/**
 Update accounts, besides the deactivated ones

 @method update
 @return {Object} cursor
 */
HucAccounts.update = function() {
  return this._collection.update.apply(this, this._addToQuery(arguments));
};

/**
 Update accounts, including the deactivated ones

 @method updateAll
 @return {Object} cursor
 */
HucAccounts.updateAll = function() {
  return this._collection.update.apply(this, this._addToQuery(arguments, {includeDeactivated: true}));
};

/**
 Update accounts, including the deactivated ones

 @method upsert
 @return {Object} cursor
 */
HucAccounts.upsert = function() {
  return this._collection.upsert.apply(this, this._addToQuery(arguments, {includeDeactivated: true}));
};

/**
 Starts fetching and watching the accounts

 @method init
 */
HucAccounts.init = function() {
  var _this = this;

  if (typeof webu === 'undefined') {
    console.warn('HucAccounts couldn\'t find webu, please make sure to instantiate a webu object before calling HucAccounts.init()');
    return;
  }

  Tracker.nonreactive(function() {
    _this._addAccounts();

    _this._updateBalance();
    _this._watchBalance();

    // check for new accounts every 2s
    Meteor.clearInterval(_this._intervalId);
    _this._intervalId = Meteor.setInterval(function() {
      _this._addAccounts();
    }, 2000);
  });
};
