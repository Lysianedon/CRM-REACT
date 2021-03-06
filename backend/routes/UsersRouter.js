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
//Import middlewares
const protect = require('../middlewares/Protect');
// ------------------------------------ MIDDLEWARES -----------------------------------------

function validateUser (req,res,next) {

    let user = req.body;

    const schema = Joi.object({
        email : Joi.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/).min(1).max(50).required(),
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
    const password = req.body.password;
    let user = req.body;

    //Validating the user's info with Joi : 
    const schema = Joi.object({
        email : Joi.string().min(1).max(50).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/).required(),
        password : joiPassword.string().min(6).max(60).minOfNumeric(1).required(),
    })

    const validateUser = schema.validate(user);

    if (validateUser.error) {
        return res.status(400).json({
            message : validateUser.error.details[0].message,
        })
    }

    //Checking if the user exists in the database : 
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

    //If the password is incorrect, an error message is displayed :
    if (!isPasswordValid) {
        return res.status(400).json({
            error: "Email or password incorrect"});
    }

    req.user = user;

    next();
}

async function checkIfAdmin(req,res,next){

    //Find user :
    let user;
    
    try {
        user = await UserDB.findById(req.verifiedUserInfos.id) 
    } catch (error) {
        console.log(error);
        return res.status(400).json({error : "A problem happened."})
    }

    if (user.isAdmin === false) {
        return res.status(401).json({error : "Access denied. You must be an admin to access this page."})
    }

    next();
}

async function validateID(req,res,next){

    //Validating ID with Joi : 
    let user, id = req.body.id;
    const schema = Joi.object({
        id : joiPassword.string().min(1).max(70).minOfNumeric(1).required(),
    })

    const validateID = schema.validate(req.body);

    if (validateID.error) {
        return res.status(400).json({
            message : validateID.error.details[0].message,
        })
    }

    //Checking if ID exists : 

    try {
        user = await UserDB.findById(id)
    } catch (error) {
        // console.log(error);
        return res.status(400).json({error : "User not found."})
    }

    if (!user) {
        return res.status(404).json({error : "User not found."})
    }

    req.deletedUser = user;
    next();
}


// ----------------------------------------- ROUTES -----------------------------------------
//--------------------------- WE ARE IN : localhost:8000/users/ -----------------------------

router.get('/',protect, checkIfAdmin, async (req,res)=> {
    
    let usersList;
    
    try {
        usersList = await UserDB.find();
    
    } catch (error) {
        console.log(error);
        return res.status(400).json({error : "A problem happened."})
    }
    
    return res.json({usersList})
})

//check if ID exists : 

router.delete('/', protect, checkIfAdmin, validateID, async (req,res)=> {

    let usersList, deletedUser = req.body.id;
    //Getting the list of users : 
    try {
        deletedUser = await UserDB.findById(deletedUser);

        //If the user is an admin : a 401 error is sent : 
        if (deletedUser.isAdmin === true) {
            return res.status(401).json({error : "You cannot delete another admin."}) 
        }
        //Deleting the user : 
        deletedUser = await UserDB.findByIdAndDelete(deletedUser);
        
        //Getting the updated user's list : 
        usersList = await UserDB.find();
        
    } catch (error) {
        console.log(error);
        return res.status(400).json({error : "A problem happened."})
    }

    return res.json({message : `User ${deletedUser._id} successfully deleted !`, usersList});
})

//CREATE A NEW USER ------------- 
router.post('/register', validateUser,checkIfUserAlreadyExists, async (req,res)=> {

    let user, updatedUser;
    const email = req.body.email;
    const password = req.body.password;

    //Hashing the password : 
    const hashedPassword = await bcrypt.hash(password, 12);
    // console.log("hashed password: ", hashedPassword);

    try {
        await await UserDB.create({email, password : hashedPassword});
        user = await UserDB.findOne({email});
        updatedUser = await UserDB.findOneAndUpdate({email}, {isAdmin : false});

    } catch (error) {
        console.log(error);
        return res.status(400).json({error: "A problem occured."})
    }

    return res.status(201).json({message : "Account successfully created!", user});
})

//LOG A USER ------------- 

router.post('/login', validateLogin, async (req,res)=> {

    let user = req.user;

    try {
        user = await UserDB.findOne({email : user.email});

    } catch (error) {
        console.log(error);
        return res.status(400).json({message : "A problem occured."}) 
    }

    //Generating a token : 
    const token = jwt.sign({id : user._id}, process.env.DB_SECRET, {expiresIn : "50m"});

    //Adding the token to a cookie :
    res.cookie("jwt", token, {httpOnly: true, secure: false});

    //Sending the cookie to the user:
    return res.json({success : "Cookie sent !", user})
})





// Exporting the router
module.exports = router;