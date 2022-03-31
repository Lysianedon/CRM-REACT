const express = require('express');
const app = express();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");


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

//exporting middleware
module.exports = protect;