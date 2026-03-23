const mongoose = require('mongoose');
const s = new mongoose.Schema({
  content:{type:mongoose.Schema.Types.ObjectId,ref:'Content',required:true},
  season:{type:Number,default:1}, episode:{type:Number,required:true},
  title:{type:String,required:true}, description:String, thumbnail:String, duration:String,
  videoServers:[{serverName:String,embedUrl:String,quality:{type:String,default:'HD'}}],
  downloadLinks:[{label:String,url:String,quality:String}],
  published:{type:Boolean,default:true}, createdAt:{type:Date,default:Date.now}
});
module.exports = mongoose.model('Episode', s);
