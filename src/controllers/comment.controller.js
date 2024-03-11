import mongoose, { isValidObjectId } from "mongoose"
import {Comment} from "../models/comment.model.js"
import {Video} from "../models/video.model.js"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js" 
import { asyncHandler } from "../utils/asyncHandler.js"

const getVideoComments = asyncHandler(async(req,res)=>{
   const {videoId} = req.params;
   const {page = 1, limit = 10}  = req.query;

   if(!isValidObjectId(videoId)){
    throw new ApiError(400,"Invalid video id")
   }

   if(page<1 || limit>10){
    throw new ApiError(400,"Invalid page number or limit");
   }

   const video = await Video.findById(videoId);

   if(!video){
    throw new ApiError(400,"Video not found");
   }

   const videoComments = Comment.aggregate([
    {
        $match:{
            video: new mongoose.Types.ObjectId(video)
        }
    },
    {
        $lookup:{
            from: "users",
            localField:"owner",
            foreignField:"_id",
            as: "commentOwner"
        }
    },
    {
        $lookup:{
            from:"likes",
            localField:"_id",
            foreignField:"comment",
            as:"commentLikes"
        }
    },
    {
        $addFields:{
            commentLikesCount:{
                $size:"$commentLikes"
            },
            commentOwner:{
                $first:"$commentOwner"
            },
            isLiked:{
                $cond:{
                    if: {$in:[req.user?._id,"$commentLikes.likedBy"]},
                    then: true,
                    else:false
                }
            }
        }
    },
    {
        $project:{
            content:1,
            createdAt:1,
            commentLikesCount:1,
            commentOwner:{
                username: 1,
                avatar:1
            },
            isLiked:1
        }
    }
   ]);

   const options = {
    page: parseInt(page,10),
    limit: parseInt(limit,10)
   }

   const comments = await Comment.aggregatepaginate(
    videoComments,
    options
   );

   if(!comments){
    return res
    .status(200)
    .json(new ApiResponse(200,comments,"Video comments fetched successfully"))
   }
});

export const addComment = asyncHandler(async(req,res)=>{
    const{videoId} = req.params;
    const{content} = req.body;

    if(content === ""){
        throw new ApiError(400,"Content is required");
    }

    if(!isValidObjectId(videoId)){
        throw new ApiError(400,"Invlaid videoId");
    }

    const video = await Video.findById(videoId);

    if(!video){
        throw new ApiError(400,"Video not found");
    }

    const comment  = await Comment.create({
        content,
        video: video._id,
        owner: req.user?._id
    });

    if(!comment){
        throw new ApiError(400,"Error creating comment");
    }

    return res
    .status(200)
    .json(new ApiResponse(200,comment,"Comment created successfully"));
});

export const updateComment = asyncHandler(async(req,res)=>{
    const {commentId} = req.params;
    const {content} = req.body;

    if(content === ""){
        throw new ApiError(400,"Content is required");
    }

    if(!isValidateObjectId(commentId)){
        throw new ApiError(400,"Invalid Comment Id")
    }

    const updateComment = await Comment.findById(commentId);

    if(!updateComment){
        throw new ApiError(400,"Comment not found")
    }

    let updatedComment;
    if(updateComment.owner.toString()===req.user?._id.toString()){
        updatedComment = await Comment.findByIdAndUpdate(
            commentId,
            {
                $set:{content}
            },
            {new:true}
        )
    }

    return res
    .status(200)
    .json(new ApiResponse(200,updateComment,"Comment updated successfully"));
});

export const deleteComment = asyncHandler(async(req,res)=>{
    const {commentId} = req.params;

    if(!isValidObjectId(commentId)){
        throw new ApiError(400,"Invalid commentId")
    }

    const deleteComment = await Comment.findById(commentId);

    if(!deleteComment){
        throw new ApiError(404,"Invalid CommentId");
    }

    if(deleteComment.owner.toString()===req.user?._id.toString()){
        const deletedComment = await Comment.findByIdAndDelete(commentId)

    if(deleteComment){
        await Like.deleteMany({comment: deletedComment._id})
      }
      else{
        throw new ApiError(404,"Something went wrong while deleting the comment")
      }
    }
    else{
        throw new ApiError(404,"Unauthorized access");
    }

    return res
    .status(200)
    .json(new ApiResponse(200,{},"Comment deleted Successfully"));
});
