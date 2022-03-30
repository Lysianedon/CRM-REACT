const mongoose = require('mongoose');


const userScheme = new mongoose.Schema({

    email : {
        type : String,
        required : true,
		minlength : 1,
		maxlength : 40,
		lowercase : true,
		unique: true,
    },

    password : {
        type : String,
        required : true,
		minlength : 1,
		maxlength : 100,
    }
}) 

const UserDB = mongoose.model("UserDB", userScheme);

//Exporting the model:
module.exports = UserDB;