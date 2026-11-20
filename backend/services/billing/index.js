import express from "express"
import dotenv from "dotenv"
import connectDb from "./config/db.js"
import router from "./routes/billing.route.js"

dotenv.config()

const port = process.env.PORT || 3003

const app=express()
app.use(express.json())
app.use("/",router)
app.get("/",(req,res)=>{
    res.json({message:"hello from billing"})
})

app.get("/health",(req,res)=>{
    res.json({status:"ok",service:"billing"})
})

app.listen(port,()=>{
    console.log(`billing started at ${port}`)
    connectDb()
})
