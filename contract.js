'use strict';
var Condition = function (text) {
    if (text) {
        var obj = JSON.parse(text);
        this.part = new BigNumber(obj.part);
        this.days = obj.days;
        this.balance = new BigNumber(obj.balance);
        this.timestamp = obj.timestamp;
        this.trustee = obj.trustee;
    } else {
        this.part = 0;
        this.days = 0;
        this.balance = 0;
        this.timestamp = new Date();
        this.trustee = "";
    }


};

Condition.prototype = {
    toString: function () {
        return JSON.stringify(this);
    }
};

var KeeperContract = function () {
    LocalContractStorage.defineMapProperty(this, "keeper", {
        parse: function (part, days, value, date) {
            return new Condition(part, days, value, date);
        },
        stringify: function (o) {
            return o.toString();
        }
    });
};

KeeperContract.prototype = {
    init: function () {

    },

    deposit: function (part, days, to) {
        var address;
        if (to) {
            if (Blockchain.verifyAddress(to)) {
                address = to;
            } else {
                throw new Error("Incorrect address");
            }
        } else {
            address = Blockchain.transaction.from;
        }
        var old_condition = this.keeper.get(address);
        var value = new BigNumber(Blockchain.transaction.value);

        if (old_condition) {
            old_condition.balance = value.plus(old_condition.balance);
            this.keeper.put(address, old_condition);
        } else {
            if (part && days && (part > 0)) {
                var condition = new Condition();
                condition.balance = value;
                condition.part = part;
                condition.days = days;
                condition.timestamp = new Date();
                if (to) {
                    condition.trustee = Blockchain.transaction.from;
                }
                this.keeper.put(address, condition);
            } else {
                throw new Error("Wrong arguments");
            }
        }
    },

    withdraw: function (to) {
        var address = Blockchain.transaction.from;
        var condition = this.keeper.get(address);
        if (condition) {
            var now = new Date();
            var deposit_date = new Date(condition.timestamp);
            var required = new Date(condition.days * 86400000);

            if ((now - deposit_date).valueOf() > required.valueOf()) {

                condition.timestamp = new Date(deposit_date.valueOf() + required.valueOf());
                var client_balance = new BigNumber(condition.balance);
                var amount = new BigNumber(condition.part * 1000000000000000000);
                if (client_balance.lessThanOrEqualTo(0)) {
                    throw new Error("Zero balance");
                }

                if (amount.greaterThan(client_balance)) {
                    amount = client_balance;
                }

                condition.balance = client_balance.sub(amount);
                this.keeper.put(address, condition);

                if (to) {
                    if (Blockchain.verifyAddress(to)) {
                        address = to;
                    } else {
                        throw new Error("Incorrect address");
                    }
                }

                var result = Blockchain.transfer(address, amount);
                if (!result) {
                    throw new Error("Transaction failed")
                }
            } else {
                throw new Error("Not enough time passed")
            }
        } else {
            throw new Error("No existing account");
        }
    },

    changeCondition: function (part, days, to) {
        if (to) {
            if (Blockchain.verifyAddress(to)) {
                var old_condition = this.keeper.get(to);
                if (old_condition) {
                    if (old_condition.trustee === Blockchain.transaction.from) {
                        if (part && days && (part > 0)) {
                            var condition = new Condition();
                            condition.balance = old_condition.balance;
                            condition.trustee = old_condition.trustee;
                            condition.timestamp = old_condition.timestamp;
                            condition.part = part;
                            condition.days = days;
                            this.keeper.put(to, condition);
                        } else {
                            throw new Error("Wrong arguments");
                        }
                    } else {
                        throw new Error("Can't change conditions from this address");
                    }
                } else {
                    throw new Error("Account doesn't exist");
                }
            } else {
                throw new Error("Incorrect address");
            }
        } else {
            var address = Blockchain.transaction.from;
            var o_condition = this.keeper.get(address);
            if (o_condition) {
                var value = new BigNumber(Blockchain.transaction.value);
                if (value.greaterThanOrEqualTo(o_condition.balance)) {
                    if (part && days && (part > 0)) {
                        var condition = new Condition();
                        condition.balance = value.plus(o_condition.balance);
                        condition.trustee = o_condition.trustee;
                        condition.timestamp = o_condition.timestamp;
                        condition.part = part;
                        condition.days = days;
                        this.keeper.put(address, condition);
                    } else {
                        throw new Error("Wrong arguments");
                    }
                } else {
                    throw new Error("Not enough to change conditions");
                }
            } else {
                throw new Error("Account doesn't exist");
            }
        }
    },

    accept: function (address) {
        if (address) {
            this.deposit(0,0,address)
        } else {
            this.deposit();
        }

    },

    checkBalance: function(){
        var from = Blockchain.transaction.from;
        var condition = this.keeper.get(from);
        if (condition){
            return "Your balance is: " + condition.balance.div(1000000000000000000).toString();
        } else {
            return "Account doesn't exist";
        }

    },

    debug: function (command, address) {
        var condition;
        if (address) {
            condition = this.keeper.get(address);
        } else {
            condition = this.keeper.get(Blockchain.transaction.from);
        }
        var deposit_date = new Date(condition.timestamp);
        var now = new Date();
        var required = new Date(condition.days * 86400000);

        switch (command) {
            case 'balance':
                return "Your balance is: " + condition.balance.div(1000000000000000000).toString();
            case 'basic' :
                return "part:" + condition.part + " days:" + condition.days;
            case 'date':
                return " dep_date:" + deposit_date + " now:" + now + " required: " + required;
            case 'trustee':
                return condition.trustee;
        }
    },
};
module.exports = KeeperContract;
