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
const Contact = require('../models/ContactsModel');
const UserDB = require('../models/UsersModel');

dotenv.config({
	path: "../config.env",
});


// ------------------------------------ MIDDLEWARES -----------------------------------------

function protect(req,res,next){

    //Checking the token that is in the cookie : 
    try {
        data = jwt.verify(req.cookies.jwt, process.env.DB_SECRET);

    } catch (error) {
        res.clearCookie("jwt");
        return res.status(401).json({
            error : "Invalid or expired token. Please login first."
        })
    }
    req.verifiedUserInfos = data;
    next();
}

function validateContact(req,res,next){

    const contact = req.body;

    const schema = Joi.object({
        name : Joi.string().min(1).max(30).required(),
        email : Joi.string().min(1).max(50).required(),
        description : Joi.string().min(1).max(500).required(),
        category : Joi.number().integer().min(1).max(10).strict().required()

    })

    const validateContact = schema.validate(contact);

    if (validateContact.error) {
        return res.status(400).json({
            message : validateContact.error.details[0].message,
        })
    }

    req.contact = contact;

    next();
}


// ----------------------------------------- ROUTES -----------------------------------------
//--------------------------- WE ARE IN : localhost:8000/contacts/ --------------------------

//GET THE USER'S CONTACTS -------------------
router.get('/', protect, async (req,res)=> {
    let contacts, count;

    try {
        // contacts = await UserDB.findById(req.verifiedUserInfos.id).select("data").populate("Contact");
        contacts = await UserDB.findById(req.verifiedUserInfos.id);
        console.log(contacts);
        contacts = await UserDB.findById(req.verifiedUserInfos.id).populate("data");
        
    } catch (error) {
        console.log(error);
        return res.status(400).json({error : "A problem occured."})
    }

    count = contacts.data.length;
    return res.json({data : contacts.data, count})
})

//CREATE A NEW CONTACT ----------------------
router.post('/', protect, validateContact , async (req,res)=> {

    let user, newContact, email = req.body.email;

    try {
        user = await UserDB.findById(req.verifiedUserInfos.id);

        //Creating the contact :
        newContact = await Contact.create(req.body);

        //Adding the user's ID to the contact document : 
        newContact = await Contact.findOneAndUpdate({email}, {userId :req.verifiedUserInfos.id})

        //Finding the new contact : 
        newContact = await Contact.findOne({email})

        //Adding the new contact's ID to the user's data array (in his/her doc) :
        user = await UserDB.findOneAndUpdate(
            {_id : user._id},
            {
                $push : {
                    data : newContact._id
                }
            } 
            );

    } catch (error) {
        return res.status(400).json({error : "A problem occured."})
    }
    return res.status(201).json({message : "Contact successfully created !", contact : newContact});
})

//MODIFY A CONTACT
//Check ID to see if it exists in the user's list : 
//Validate contact :
router.put('/',protect, async (req,res) => {

    const updatedContact = await Contact.findByIdAndUpdate(req.body.id, req.body)
    return res.json({success : `contact ID ${updatedContact._id} successfully updated !`, updatedContact})

})







// Exporting the router
module.exports = router;