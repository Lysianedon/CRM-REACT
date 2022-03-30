const express = require('express');
const app = express();
const router = express.Router();
const cors = require('cors');
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
//Libraries : 
const mongoose = require("mongoose"); //MongoDB
const Joi = require('Joi');
const { joiPassword } = require('joi-password');

const { Pool } = require("pg");
const Postgres = new Pool({ ssl: { rejectUnauthorized: false } });
//Models:
const UserDB = require('../models/UsersModel');

dotenv.config({
	path: "../config.env",
});
// ------------------------------------ MIDDLEWARES -----------------------------------------

function validateUser (req,res,next) {

    let user = req.body;

    const schema = Joi.object({
        email : Joi.string().min(1).max(50).required(),
        password : joiPassword.string().min(6).max(60).minOfNumeric(1).required(),
        confirmPassword:Joi.string().required().valid(Joi.ref('password')),
    })

    const validateUser = schema.validate(user);

    if (validateUser.error) {
        return res.status(400).json({
            message : validateUser.error.details[0].message,
        })
    }

    req.user = req.body;

    next();
}

async function checkIfUserAlreadyExists(req,res,next) {

    let user;

    try {
        user = await UserDB.findOne({email : req.body.email});
    } catch (error) {
        console.log(error);
        return res.status(400).json({error : "A problem occured."})
    }

    if (user) {
        return res.status(401).json({error : "this email already has an account. Did you want to login ?"})
    }

    next();
}

async function validateLogin(req,res,next){

    let user;
    const password = req.body.password;

    try {
        user = await UserDB.findOne({email : req.body.email});
    } catch (error) {
        console.log(error);
        return res.status(400).json({error : "A problem occured."})
    }

    if (!user) {
        return res.status(400).json({error : "Email or password incorrect"})
    }

    //Comparing the login's password with the one registered in the user's document:
    const isPasswordValid = await bcrypt.compare(password, user.password);

    //If the password is incorrect, an error message is displayed
    if (!isPasswordValid) {
        return res.status(400).json({
            error: "Email or password incorrect"});
    }

    req.user = user;

    next();
}


// ----------------------------------------- ROUTES -----------------------------------------
//--------------------------- WE ARE IN : localhost:8000/users/ -----------------------------

router.get('/', (req,res)=> {
    res.send('Hello');
})


//CCREATE A NEW USER ------------- 
router.post('/register', validateUser,checkIfUserAlreadyExists, async (req,res)=> {

//-------------------------------- POSTGREQSL ----------------------------
    // try {

    //     user = await Postgres.query("INSERT INTO users (email, password)VALUES($1,$2)", 
    //     [req.body.email, req.body.password])
    // } catch (error) {
    //     console.log(error);
    //     return res.status(400).json({message : "A problem occured."}) 
    // }

    // user = await Postgres.query("SELECT * from users WHERE users.email = $1", [req.body.email]);
    // // console.log("before::::",user);
    // user = user.rows;
    // // console.log("after::::",user);

    //------------------------------- MONGODB -----------------------------
    let user;
    const email = req.body.email;
    const password = req.body.password;

    //Hashing the password : 
    const hashedPassword = await bcrypt.hash(password, 12);
    console.log("hashed password: ", hashedPassword);

    try {
        await await UserDB.create({email, password : hashedPassword});
        user = await UserDB.findOne({email});
    } catch (error) {
        console.log(error);
        return res.status(400).json({error: "A problem occured."})
    }

    return res.status(201).json({message : "Account successfully created!", user});
})

//LOG A USER ------------- 

router.post('/login', validateUser, validateLogin, async (req,res)=> {

    let user = req.user;

    try {
        user = await UserDB.findOne({email : user.email});

    } catch (error) {
        console.log(error);
        return res.status(400).json({message : "A problem occured."}) 
    }

    //Generating a token : 
    const token = jwt.sign({id : user._id}, process.env.DB_SECRET);

    //Adding the token to a cookie :
    res.cookie("jwt", token, {httpOnly: true, secure: false});

    //Sending the cookie to the user:
    res.json({success : "Cookie sent !", user})
})




// Exporting the router
module.exports = router;