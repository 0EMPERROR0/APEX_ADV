/**
 * Qt WebChannel JavaScript Client API
 * Copyright (C) 2016 The Qt Company Ltd.
 * SPDX-License-Identifier: LGPL-3.0-only OR GPL-2.0-only OR GPL-3.0-only
 */
(function() {
    "use strict";

    var QWebChannelMessageTypes = {
        signal: 1,
        propertyUpdate: 2,
        init: 3,
        idle: 4,
        debug: 5,
        invokeMethod: 6,
        connectToSignal: 7,
        disconnectFromSignal: 8,
        setProperty: 9,
        response: 10
    };

    var QWebChannel = function(transport, initCallback) {
        if (typeof transport !== "object" || typeof transport.send !== "function") {
            console.error("The supplied transport object is not a valid QWebChannel transport.");
            return;
        }

        var channel = this;
        this.transport = transport;

        this.send = function(data) {
            channel.transport.send(JSON.stringify(data));
        };

        this.transport.onmessage = function(message) {
            var data = message.data;
            if (typeof data === "string") {
                data = JSON.parse(data);
            }
            switch (data.type) {
                case QWebChannelMessageTypes.signal:
                    channel.handleSignal(data);
                    break;
                case QWebChannelMessageTypes.response:
                    channel.handleResponse(data);
                    break;
                case QWebChannelMessageTypes.propertyUpdate:
                    channel.handlePropertyUpdate(data);
                    break;
                default:
                    console.error("Invalid message type received: ", data.type);
                    break;
            }
        };

        this.execCallbacks = {};
        this.execId = 0;
        this.objects = {};

        this.handleSignal = function(message) {
            var object = channel.objects[message.object];
            if (object) {
                object.signalEmitted(message.signal, message.args);
            } else {
                console.warn("Unhandled signal: " + message.object + "::" + message.signal);
            }
        };

        this.handleResponse = function(message) {
            if (!message.hasOwnProperty("id")) {
                console.error("Invalid response received: ", JSON.stringify(message));
                return;
            }
            var callback = channel.execCallbacks[message.id];
            if (callback) {
                delete channel.execCallbacks[message.id];
                callback(message.data);
            }
        };

        this.handlePropertyUpdate = function(message) {
            for (var i in message.data) {
                var data = message.data[i];
                var object = channel.objects[data.object];
                if (object) {
                    object.propertyUpdate(data.signals, data.properties);
                } else {
                    console.warn("Unhandled property update: " + data.object);
                }
            }
            channel.exec({type: QWebChannelMessageTypes.idle});
        };

        this.exec = function(data, callback) {
            if (!callback) {
                channel.send(data);
                return;
            }
            if (channel.execId === Number.MAX_VALUE) {
                channel.execId = 0;
            }
            if (data.hasOwnProperty("id")) {
                console.error("Cannot exec message with pre-existing id: " + JSON.stringify(data));
                return;
            }
            data.id = channel.execId++;
            channel.execCallbacks[data.id] = callback;
            channel.send(data);
        };

        this.unwrapQObject = function(response) {
            if (response instanceof Array) {
                return response.map(function(item) {
                    return channel.unwrapQObject(item);
                });
            }
            if (response && response["__QObject*__"]) {
                return channel.objects[response["id"]];
            }
            return response;
        };

        this.init = function(callback) {
            channel.exec({type: QWebChannelMessageTypes.init}, function(data) {
                for (var objectName in data) {
                    var object = new QObject(objectName, data[objectName], channel);
                    channel.objects[objectName] = object;
                }
                for (var objectName in channel.objects) {
                    channel.objects[objectName].initializeProperties();
                }
                if (callback) {
                    callback(channel);
                }
            });
        };

        this.init(initCallback);
    };

    function QObject(name, data, webChannel) {
        this.__id__ = name;
        var qObject = this;

        this.signalEmitted = function(signalName, signalArgs) {
            var signal = qObject[signalName];
            if (signal) {
                signal.emit.apply(signal, signalArgs);
            } else {
                console.warn("Unhandled signal: " + name + "::" + signalName);
            }
        };

        this.propertyUpdate = function(signals, propertyMap) {
            for (var propertyIndex in propertyMap) {
                var propertyValue = propertyMap[propertyIndex];
                qObject[propertyIndex] = webChannel.unwrapQObject(propertyValue);
            }
            for (var signalName in signals) {
                qObject.signalEmitted(signalName, signals[signalName]);
            }
        };

        this.initializeProperties = function() {
            for (var propertyName in data.properties) {
                qObject[propertyName] = webChannel.unwrapQObject(data.properties[propertyName]);
            }
        };

        for (var i = 0; i < data.methods.length; ++i) {
            (function(methodName) {
                qObject[methodName] = function() {
                    var args = [];
                    var callback;
                    for (var j = 0; j < arguments.length; ++j) {
                        if (typeof arguments[j] === "function") {
                            callback = arguments[j];
                        } else {
                            args.push(arguments[j]);
                        }
                    }
                    webChannel.exec({
                        type: QWebChannelMessageTypes.invokeMethod,
                        object: qObject.__id__,
                        method: methodName,
                        args: args
                    }, function(response) {
                        if (callback) {
                            callback(webChannel.unwrapQObject(response));
                        }
                    });
                };
            })(data.methods[i]);
        }

        for (var signalName in data.signals) {
            (function(name) {
                qObject[name] = {
                    connect: function(callback) {
                        if (typeof callback !== "function") {
                            console.error("Bad callback given to connect to signal " + name);
                            return;
                        }
                        this.connections.push(callback);
                    },
                    disconnect: function(callback) {
                        this.connections = this.connections.filter(function(c) {
                            return c !== callback;
                        });
                    },
                    emit: function() {
                        for (var i = 0; i < this.connections.length; ++i) {
                            this.connections[i].apply(this, arguments);
                        }
                    },
                    connections: []
                };
            })(signalName);
        }
    }

    if (typeof module !== "undefined" && typeof module.exports !== "undefined") {
        module.exports = { QWebChannel: QWebChannel };
    } else {
        window.QWebChannel = QWebChannel;
    }
})();
