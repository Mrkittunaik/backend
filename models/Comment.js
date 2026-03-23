const mongoose = require('mongoose');
const s = new mongoose.Schema({
  content:{type:mongoose.Schema.Types.ObjectId,ref:'Content',required:true},
  user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
  text:{type:String,required:true}, rating:{type:Number,min:1,max:10},
  approved:{type:Boolean,default:true}, createdAt:{type:Date,default:Date.now}
});
module.exports = mongoose.model('Comment', s);
