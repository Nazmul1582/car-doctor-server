const express = require('express');
const cors = require('cors');
var jwt = require('jsonwebtoken');
const cookieParser = require("cookie-parser")
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();

// middleware
app.use(cors({
  origin: ["http://localhost:5173"],
  credentials: true
}))
app.use(express.json())
app.use(cookieParser())

// custom middlewate 
const logger = (req, res, next) => {
  console.log("called: ", req.host, req.originalUrl);
  next();
}

const varifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  console.log("value of the token in middleware: ", token);
  if(!token){
    return res.status(401).send({message: "unauthorized!"})
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if(err){
      console.log(err);
      return res.status(401).send({message: "unauthorized!"})
    }

    // if token is valid then it would be decoded
    req.user = decoded;
    next();
  })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.vatgn7i.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const serviceCollection = client.db('carDoctorDB').collection('services');
    const bookingCollection = client.db("carDoctorDB").collection("bookings")

    // auth related api
    app.post("/jwt", async(req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: "1h"})
      res
      .cookie('token', token, {
        httpOnly: true,
        secure: false, // http://localhost:5173
      })
      .send({success: true})
    })

    app.post("/logout", async(req, res) => {
      const user = req.body;
      console.log("logout user", user);
      res.clearCookie('token', {maxAge: 0}).send({success: true})
    })

    // services related api
    app.get("/services", logger, async(req, res) => {
        const cursor = serviceCollection.find();
        const result = await cursor.toArray();
        res.send(result);
    })

    app.get("/services/:id", async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await serviceCollection.findOne(query)
      res.send(result)
    })

    // get some property of a specific service
    app.get('/services/checkout/:id', async(req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const options = {
        projection: { img: 1, title: 1, price: 1}
      };
      const result = await serviceCollection.findOne(filter, options);
      res.send(result)
    })

    // bookings
    
    app.get("/bookings", logger, varifyToken, async(req, res) => {
      // console.log("token", req.cookies.token)
      console.log("user in the valid token: ", req.user);
      if(req.query.email !== req.user.email){
        return res.status(403).send({message: "forbidden access"})
      }
      
      let query = {}
      if(req.query?.email){
        query = {email: req.query.email}
      }
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    })

    app.post("/bookings", async(req, res) => {
      const booking = req.body;
      const result = await bookingCollection.insertOne(booking)
      res.send(result)
    })

    app.delete("/bookings/:id", async(req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const result = await bookingCollection.deleteOne(filter)
      res.send(result);
    })

    app.patch('/bookings/:id', async(req, res) => {
      const id = req.params.id;
      const updatedBooking = req.body;
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          status: updatedBooking.status
        }
      }
      const result = await bookingCollection.updateOne(filter, updateDoc)
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get("/", (req, res) => {
    res.send("Car Doctor is running...")
})

app.listen(port, () => {
    console.log(`Car Doctor Server is running on PORT ${port}`)
})