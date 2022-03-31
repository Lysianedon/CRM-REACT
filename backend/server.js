const express = require('express');
const app = express();
const cors = require('cors');
const port = 8000;
const router = express.Router();
const cookieParser = require("cookie-parser");
const Contacts = require('./routes/ContactsRouter');
const Users = require('./routes/UsersRouter');
//Libraries : 
const mongoose = require("mongoose"); //MongoDB
const Joi = require("Joi");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const { Pool } = require("pg");
const Postgres = new Pool({ ssl: { rejectUnauthorized: false } });

dotenv.config({
	path: "../config.env",
});

// CONNECTING TO MONGODB :
mongoose
	.connect(
		`mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.5sekn.mongodb.net/konexio?retryWrites=true&w=majority`,
		{
			useNewUrlParser: true,
		}
	)
	.then(() => console.log("Connected to MongoDB"));

// ---------------------------------- MIDDLEWARES -----------------------------------------
app.use(cors());
app.use(express.json());
app.use(cookieParser());
const debug = app.use((req,res,next)=> {
    console.log("request received");
    next();
})

function cookieJwtAuth(req, res, next) {

    const token = req.cookies.token;

    try {
       const user = jwt.verify(token, process.env.DB_SECRET);
       req.user = user;
    } catch (error) {
       console.log(error);
       res.clearCookie("token");
       return res.status(401).json({error : "Invalid token. Please login first."}) 
    }

    next();
}



// ROUTES --------------------

app.use('/users', Users)
app.use('/contacts', Contacts)
// ----------------------------------------- ROUTES -----------------------------------------
//------------------------------ WE ARE IN : localhost:8000/ --------------------------------

app.get('/', (req,res)=> {
    res.json({message : "HOMEPAGE"});
})

//LOGOUT USER -------------------
app.get('/logout', (req,res)=> {
    res.clearCookie("jwt");
    // console.log(req.cookies);
    return res.json({cookies : req.cookies})
})


// ----------------------------------- 404 NOT FOUND ROUTES ---------------------------------
// ------------------------------------------------------------------------------------------
app.get('*', (req,res)=> {
    res.status(404).json({message : "404 NOT FOUND."});
})

app.post('*', (req,res)=> {
    res.status(404).json({message : "404 NOT FOUND."});
})

app.put('*', (req,res)=> {
    res.status(404).json({message : "404 NOT FOUND."});
})

app.patch('*', (req,res)=> {
    res.status(404).json({message : "404 NOT FOUND."});
})

app.delete('*', (req,res)=> {
    res.status(404).json({message : "404 NOT FOUND."});
})


//Starting the server
app.listen(port, () => {
    console.log(`Local host launched at port ${port}`)
})