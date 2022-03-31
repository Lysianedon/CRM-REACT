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
        email : Joi.string().min(1).max(50).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/).required(),
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

async function validateContactOptions(req,res,next){

    const updatedContact = req.body;

    const schema = Joi.object({
        _id : Joi.string().min(1).max(70).required(),
        name : Joi.string().min(1).max(30),
        email : Joi.string().min(1).max(50).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
        description : Joi.string().min(1).max(500),
        category : Joi.number().integer().min(1).max(10).strict(),

    })

    const validateContact = schema.validate(updatedContact);

    if (validateContact.error) {
        return res.status(400).json({
            message : validateContact.error.details[0].message,
        })
    }

    //Checking to see if contact's ID exists in user's DB: if not, the user gets a 404 error:
    let doesContactExist;
    try {
        doesContactExist =  await Contact.findById(updatedContact._id);
        
    } catch (error) {
        return res.status(404).json({error : "Contact ID not found in your contacts' list. Please choose a valid one."})
    }

    if (!doesContactExist) {
        return res.status(404).json({error : "Contact ID not found in your contacts' list. Please choose a valid one."})
    } else {
        req.updatedContact = updatedContact;
        req.selectedContact = updatedContact;
    }

    next();
}

// >------- SEARCH CONTACTS BY CRITERIA -----------> 

async function searchContactsByCriteria(req,res,next){
    
    let selectedContacts = await UserDB.findById(req.verifiedUserInfos.id).populate("data");
    //Transforming our mongoose model objects into real JS objects : 
    selectedContacts =selectedContacts.toObject();
    selectedContacts = selectedContacts.data;

    //Guard : Checking if the query params exist :
    if (req.query) {
        //Adding all of my object keys into an array:
        const keys = Object.keys(req.query); 

        for (let i = 0; i < keys.length; i++) {

             //The key we are looping over : 
             let key = keys[i];
             console.log(key);
    
            // if query params doesn't exist, a 404 message is returned : 
            if (!selectedContacts[0].hasOwnProperty(key)) {
                return res.status(404).json({error : `The filter "${keys[i]}" doesn't exist.`}) 
            }

            //Adding the value to req : 
            req.key = req.query[key];

            //If no contact was found : the function returns a 404 message : 
            selectedContacts = selectedContacts.filter(contact => contact[key].toString().toLowerCase() === req.query[key].toLowerCase());

            if (selectedContacts.length === 0) {
                return res.status(404).json({error : `There is no contacts matching your criteria.`})
            }
            req.selectedContacts = selectedContacts;
        }
    }
    req.selectedContacts = selectedContacts;
    next();
}

// ----------------------------------------- ROUTES -----------------------------------------
//--------------------------- WE ARE IN : localhost:8000/contacts/ --------------------------

//GET THE USER'S CONTACTS -------------------
router.get('/', protect,searchContactsByCriteria, async (req,res)=> {
    let contacts, count;

    try {
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

//MODIFY A CONTACT --------------------------

router.put('/',protect,validateContactOptions, async (req,res) => {

    const updatedContact = req.updatedContact;
    let contact;

    try {
        contact = await Contact.findByIdAndUpdate(updatedContact._id, updatedContact)
        
    } catch (error) {
        console.log(error);
        return res.status(400).json({error: "A problem happened."})
    }

    return res.json({success : `contact ID ${contact._id} successfully updated !`, contact})

})

//DELETE A CONTACT -------------------------------
router.delete('/', protect, validateContactOptions, async (req,res) => {

    let deletedContact = req.selectedContact, user ;

    //Deleting the contact :
    try {
        deletedContact = await Contact.findByIdAndDelete(deletedContact._id);
        user = await UserDB.findById(req.verifiedUserInfos.id).populate("data");

    } catch (error) {
        console.log(error);
        return res.status(400).json({error: "A problem happened."}) 
    }

    //Deleting the ID in the user's doc : 
    try {
        await UserDB.findByIdAndUpdate(req.verifiedUserInfos.id, 
            {
                $pull : {data : deletedContact._id}
            })
        
    } catch (error) {
        console.log(error);
        return res.status(400).json({error: "A problem happened. Failed to update the user's document."}) 
    }
    return res.json({success : `contact ID ${deletedContact.email} successfully deleted !`, data : user.data})
})






// Exporting the router
module.exports = router;