const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({

    userId : {type : mongoose.Types.ObjectId, ref : "UserDB"},
    name: {
        type : String,
        required : true,
		minlength : 1,
		maxlength : 30,
		lowercase : true,
    },

    email: {
        type : String,
        required : true,
		minlength : 1,
		maxlength : 40,
		lowercase : true,
		unique: true,
    },

    description: {
        type : String,
        required : true,
		minlength : 1,
		maxlength : 250,
		lowercase : true,
    },
    category : {
        type : Number,
        minlength : 1,
		maxlength : 2,
        required : true
    }

})

const Contact = mongoose.model("Contact", contactSchema);

//Exporting the model:
module.exports = Contact;