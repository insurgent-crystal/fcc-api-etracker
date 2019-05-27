const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const cors = require('cors')
const mongoose = require('mongoose')


mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost/exercise-track')

const Schema = mongoose.Schema

const exerciseSchema = new Schema({
  description: String,
  duration: Number,
  date: Date
})

const ETUserSchema = new Schema({
  username: String,
  exercise: [{
    type: Schema.Types.ObjectId,
    ref: 'Exercise'
  }]
})

const ETUser = mongoose.model('ETUser', ETUserSchema)
const Exercise = mongoose.model('Exercise', exerciseSchema)

const createUser = (name, done) => {
  let docUser = new ETUser({
    username: name
  })
  docUser.save((error, data) => error ? done(error) : done(null, data))
}

const createExercise = (userId, description, duration, date, done) => {
  let docExercise = new Exercise({
    userId: userId,
    description: description,
    duration: duration,
    date: date ? new Date(date) : new Date()
  })
  docExercise.save((error, data) => error ? done(error) : done(null, data))
}

const getAllUsers = (done) => {
  ETUser
    .find({})
    .select('_id username')
    .exec((error, data) => error ? done(error) : done(null, data))
}

const findUser = (id, done) => {
  ETUser
    .findById(id)
    .exec((error, data) => error ? done(error) : done(null, data))
}

const findExercises = (userIds, from, to, limit, done) => {
  Exercise
    .find({
      _id: {$in: userIds},
      date: {
        $gte: from,
        $lte: to
      }
    })
    .limit(limit)
    .select('-_id -__v')
    .exec((error, data) => error ? done(error) : done(null, data))
}


app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

app.use(express.static('public'))


app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
})

// All the users
app.get('/api/exercise/users', (req, res) => {
  getAllUsers((error, data) => {
    if (error) {
      console.log(error)
      res.send('Couldn\'t find users')
    }
    res.json(data)
  })
})

// Log on specific user
app.get('/api/exercise/log', (req, res) => {
  let userId = req.query.userId
  // Set to minimum and maximum dates if not provided or provided shit
  let from = new Date(req.query.from) == 'Invalid Date' ? new Date(-8640000000000000) : new Date(req.query.from) 
  let to = new Date(req.query.to) == 'Invalid Date' ? new Date(8640000000000000) : new Date(req.query.to)
  // Set to 0 (which means "no limit") if not provided or provided shit
  let limit = isNaN(parseInt(req.query.limit)) ? 0 : parseInt(req.query.limit)
  
  
  if (typeof userId === 'undefined') {
    return res.send('Provide user ID')
  }
  
  findUser(userId, (error, data) => {
    if (error) {
      console.log(error)
      return res.send('User not found')
    }
    
    findExercises(data['exercise'], from, to, limit, (error, exercises) => {
      if (error) {
        console.log(error)
        return res.send('Couldn\'t find exercises')
      }
      
      res.json({
        _id: data['_id'],
        username: data['username'],
        count: exercises.length,
        log: exercises
      })
    })
  })
})

// Hey buddy, I think you've got the wrong door
app.post('/api/exercise/new-user', (req, res) => {
  createUser(req.body.username, (error, data) => {
    if (error) {
      console.log(error)
      res.send('Couldn\'t add new user')
    }
    
    console.log('New user: ' + data['username'])
    res.json({
      _id: data['_id'],
      username: data['username']
    })
  })
})

// Adding stuff
app.post('/api/exercise/add', (req, res) => {
  createExercise(req.body.userId,
                 req.body.description,
                 req.body.duration,
                 req.body.date,
                 (error, exerciseData) => {
    if (error) {
      console.log(error)
      res.send('Couldn\'t add an exercise')
    }
    
    findUser(req.body.userId, (error, userData) => {
      if (error) {
        console.log(error)
        res.send('User not found')
      }
      
      userData.exercise.push(exerciseData)
      userData.save((error, data) => error ? console.log(error) : console.log('New exercise'))
      ETUser
        .findById(req.body.userId)
        .populate('exercise')
        .exec((error, data) => error ? console.log(error) : console.log('for ' + data['_id']))
      
      res.json({
        username: userData['username'],
        description: exerciseData['description'],
        duration: exerciseData['duration'],
        date: exerciseData['date']
      })
    })
  })
  
  // res.json({hey: 'now'})
})


// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  
  res.status(errCode).type('txt').send(errMessage)
})


const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
