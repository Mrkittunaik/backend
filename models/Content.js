const mongoose = require('mongoose');
const s = new mongoose.Schema({
  title:{type:String,required:true}, slug:{type:String,required:true,unique:true},
  shortDescription:String, fullDescription:String, posterImage:String, bannerImage:String, trailerLink:String,
  category:{type:mongoose.Schema.Types.ObjectId,ref:'Category'},
  type:{type:String,enum:['movie','anime','series','show','cartoon'],default:'movie'},
  genres:[String], language:String, subtitles:[String], year:String,
  rating:{type:Number,default:0}, imdbRating:{type:Number,default:0}, duration:String,
  ageRating:{type:String,default:'U'}, cast:[String], director:String, studio:String, country:String,
  // Updated videoServers: supports iframe, mp4, m3u8 with isDefault flag
  videoServers:[{
    serverName: String,
    sourceType: { type: String, enum: ['iframe','mp4','m3u8'], default: 'iframe' },
    videoUrl: String,
    quality: { type: String, default: 'HD' },
    isDefault: { type: Boolean, default: false }
  }],
  downloadLinks:[{label:String,url:String,quality:String}],
  featured:{type:Boolean,default:false}, trending:{type:Boolean,default:false},
  recommended:{type:Boolean,default:false}, latest:{type:Boolean,default:false},
  published:{type:Boolean,default:true}, views:{type:Number,default:0},
  totalRatings:{type:Number,default:0}, ratingCount:{type:Number,default:0},
  seo:{metaTitle:String,metaDescription:String,metaKeywords:String},
  createdAt:{type:Date,default:Date.now}, updatedAt:{type:Date,default:Date.now}
});
module.exports = mongoose.model('Content', s);
