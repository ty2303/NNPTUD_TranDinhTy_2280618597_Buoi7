var express = require('express');
var router = express.Router();
let mongoose = require('mongoose');
let { checkLogin } = require('../utils/authHandler.js');
let reservationModel = require('../schemas/reservations');
let cartModel = require('../schemas/cart');
let inventoryModel = require('../schemas/inventories');
let productModel = require('../schemas/products');

async function buildReservationItems(rawItems, session) {
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
        throw new Error('Danh sach san pham khong hop le');
    }

    let mergedItems = [];
    for (const item of rawItems) {
        if (!item || !item.product || !Number.isInteger(item.quantity) || item.quantity <= 0) {
            throw new Error('Danh sach san pham khong hop le');
        }

        let index = mergedItems.findIndex(function (currentItem) {
            return currentItem.product.toString() === item.product.toString();
        });

        if (index < 0) {
            mergedItems.push({
                product: item.product,
                quantity: item.quantity
            });
        } else {
            mergedItems[index].quantity += item.quantity;
        }
    }

    let reservationItems = [];
    let totalAmount = 0;

    for (const item of mergedItems) {
        let product = await productModel.findOne({
            _id: item.product,
            isDeleted: false
        }).session(session);

        if (!product) {
            throw new Error('San pham khong ton tai');
        }

        let inventory = await inventoryModel.findOne({
            product: item.product
        }).session(session);

        if (!inventory) {
            throw new Error('Khong tim thay ton kho cua san pham');
        }

        if (inventory.stock < item.quantity) {
            throw new Error('San pham khong du so luong ton kho');
        }

        inventory.stock -= item.quantity;
        inventory.reserved += item.quantity;
        await inventory.save({ session: session });

        let subtotal = product.price * item.quantity;
        totalAmount += subtotal;
        reservationItems.push({
            product: product._id,
            quantity: item.quantity,
            price: product.price,
            subtotal: subtotal
        });
    }

    return {
        items: reservationItems,
        totalAmount: totalAmount
    };
}

async function createReservation(userId, rawItems, session) {
    let preparedReservation = await buildReservationItems(rawItems, session);
    let reservation = new reservationModel({
        user: userId,
        items: preparedReservation.items,
        totalAmount: preparedReservation.totalAmount,
        ExpiredAt: new Date(Date.now() + 15 * 60 * 1000)
    });
    await reservation.save({ session: session });
    return reservation;
}

router.get('/', checkLogin, async function (req, res, next) {
    let reservations = await reservationModel.find({
        user: req.userId
    }).populate({
        path: 'items.product',
        select: 'title price images'
    });

    res.send(reservations);
});

router.get('/:id', checkLogin, async function (req, res, next) {
    try {
        let reservation = await reservationModel.findOne({
            _id: req.params.id,
            user: req.userId
        }).populate({
            path: 'items.product',
            select: 'title price images'
        });

        if (!reservation) {
            return res.status(404).send({
                message: 'Reservation not found'
            });
        }

        res.send(reservation);
    } catch (error) {
        res.status(404).send({
            message: 'Reservation not found'
        });
    }
});

router.post('/reserveACart', checkLogin, async function (req, res, next) {
    let session = await mongoose.startSession();
    session.startTransaction();

    try {
        let currentCart = await cartModel.findOne({
            user: req.userId
        }).session(session);

        if (!currentCart || currentCart.items.length === 0) {
            throw new Error('Gio hang dang trong');
        }

        let reservation = await createReservation(req.userId, currentCart.items, session);
        currentCart.items = [];
        await currentCart.save({ session: session });

        await session.commitTransaction();
        session.endSession();

        reservation = await reservation.populate({
            path: 'items.product',
            select: 'title price images'
        });
        res.send(reservation);
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(400).send({
            message: error.message
        });
    }
});

router.post('/reserveItems', checkLogin, async function (req, res, next) {
    let session = await mongoose.startSession();
    session.startTransaction();

    try {
        let items = req.body;
        if (Array.isArray(req.body.items)) {
            items = req.body.items;
        }

        let reservation = await createReservation(req.userId, items, session);

        await session.commitTransaction();
        session.endSession();

        reservation = await reservation.populate({
            path: 'items.product',
            select: 'title price images'
        });
        res.send(reservation);
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(400).send({
            message: error.message
        });
    }
});

router.post('/cancelReserve/:id', checkLogin, async function (req, res, next) {
    try {
        let reservation = await reservationModel.findOne({
            _id: req.params.id,
            user: req.userId
        });

        if (!reservation) {
            return res.status(404).send({
                message: 'Reservation not found'
            });
        }

        if (reservation.status !== 'actived') {
            return res.status(400).send({
                message: 'Reservation khong the huy'
            });
        }

        for (const item of reservation.items) {
            let inventory = await inventoryModel.findOne({
                product: item.product
            });

            if (inventory) {
                inventory.reserved = Math.max(0, inventory.reserved - item.quantity);
                inventory.stock += item.quantity;
                await inventory.save();
            }
        }

        reservation.status = 'cancelled';
        await reservation.save();

        reservation = await reservation.populate({
            path: 'items.product',
            select: 'title price images'
        });
        res.send(reservation);
    } catch (error) {
        res.status(400).send({
            message: error.message
        });
    }
});

module.exports = router;
