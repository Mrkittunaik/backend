const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const s = new mongoose.Schema({
  name:{type:String,required:true}, email:{type:String,required:true,unique:true}, password:{type:String,required:true},
  avatar:{type:String,default:''}, watchlist:[{type:mongoose.Schema.Types.ObjectId,ref:'Content'}],
  continueWatching:[{content:{type:mongoose.Schema.Types.ObjectId,ref:'Content'},episode:{type:mongoose.Schema.Types.ObjectId,ref:'Episode'},progress:{type:Number,default:0},updatedAt:{type:Date,default:Date.now}}],
  notifications:[{message:String,read:{type:Boolean,default:false},createdAt:{type:Date,default:Date.now}}],
  isActive:{type:Boolean,default:true}, createdAt:{type:Date,default:Date.now}
});
s.pre('save', async function(next) { if (!this.isModified('password')) return next(); this.password = await bcrypt.hash(this.password, 10); next(); });
s.methods.comparePassword = async function(p) { return bcrypt.compare(p, this.password); };
module.exports = mongoose.model('User', s);
