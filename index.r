# Install and load required packages
if (!require(ranger)) {
  install.packages("ranger")
  library(ranger)
}
if (!require(dplyr)) {
  install.packages("dplyr")
  library(dplyr)
}

# Check if file exists and read in the training data
file_path <- "ad_events.csv"
if (!file.exists(file_path)) {
  stop("Error: 'ad_events.csv' not found")
}
df <- read.csv(file_path)

# Ensure required columns in training data
required_cols <- c("ad_id", "day_of_week", "time_of_day", "event_type")
if (!all(required_cols %in% names(df))) {
  stop("Error: Missing columns in the training dataset: ", 
       paste(required_cols[!required_cols %in% names(df)], collapse = ", "))
}

# Convert to factors
df$ad_id <- factor(df$ad_id)
df$day_of_week <- factor(df$day_of_week)
df$time_of_day <- factor(df$time_of_day)
df$success <- factor(ifelse(df$event_type == "Impression", "No", "Yes"))

# Check for missing values in the training data
if (any(is.na(df[, c("ad_id", "day_of_week", "time_of_day", "success")]))) {
  stop("Error: Missing values in the training data")
}

# Check data balance and warn if data is imbalanced
success_table <- table(df$success)
cat("\nTraining data balance (success):\n")
print(success_table)
if (success_table["Yes"] / sum(success_table) < 0.1) {
  cat("Warning: Training data is imbalanced.\n")
}

# Train the ranger model with class weights if imbalanced
class_weights <- if (success_table["Yes"] / sum(success_table) < 0.1) {
  c("No" = 1, "Yes" = 5)  # Increase weight for more clicks
} else {
  NULL
}
model <- ranger(success ~ ad_id + day_of_week + time_of_day, data = df, probability = TRUE, class.weights = class_weights)

# Create the combinations of ad_id, day_of_week, and time_of_day
all_ads <- levels(df$ad_id)
all_days <- levels(df$day_of_week)
all_times <- levels(df$time_of_day)
new_data <- expand.grid(
  ad_id = factor(all_ads, levels = all_ads),
  day_of_week = factor(all_days, levels = all_days),
  time_of_day = factor(all_times, levels = all_times)
)

# Predict probabilities for all the combinations
predictions <- predict(model, new_data)$predictions

# Create a data frame with predictions
results <- data.frame(
  ad_id = new_data$ad_id,
  day_of_week = new_data$day_of_week,
  time_of_day = new_data$time_of_day,
  prob_click = predictions[, "Yes"],  # Probability of success = "Yes" (click)
  prob_impression = predictions[, "No"]  # Probability of success = "No" (impression)
)

# Aggregate by day_of_week and time_of_day, averaging prob_click across ad_id
results_aggregated <- results %>%
  group_by(day_of_week, time_of_day) %>%
  summarise(
    avg_prob_click = mean(prob_click),
    avg_prob_impression = mean(prob_impression),
    .groups = "drop"
  ) %>%
  arrange(desc(avg_prob_click))

# Save aggregated results to CSV
output_file_general <- file.path(dirname(file_path), "general_click_predictions.csv")
write.csv(results_aggregated, output_file_general, row.names = FALSE)
cat("General predictions:", output_file_general, "\n")

# Print top 5 times for clicks
cat("\nTop 5 times to run ads):\n")
print(head(results_aggregated[, c("day_of_week", "time_of_day", "avg_prob_click")], 5))

# Print bottom 5 times
cat("\nTimes to avoid running ads:\n")
print(tail(results_aggregated[, c("day_of_week", "time_of_day", "avg_prob_click")], 5))

# Section for user-uploaded dataset
cat("\nPlease select a CSV file for prediction making (must contain ad_id, day_of_week, time_of_day columns)\n")
tryCatch({
  # Prompt user to select a CSV file
  user_file <- file.choose()
  user_data <- read.csv(user_file)
  
  # Verify required columns in user data
  user_required_cols <- c("ad_id", "day_of_week", "time_of_day")
  if (!all(user_required_cols %in% names(user_data))) {
    stop("Error: Uploaded dataset is missing required columns: ", 
         paste(user_required_cols[!user_required_cols %in% names(user_data)], collapse = ", "))
  }
  
  # Convert to factors
  user_data$ad_id <- factor(user_data$ad_id, levels = levels(df$ad_id))
  user_data$day_of_week <- factor(user_data$day_of_week, levels = levels(df$day_of_week))
  user_data$time_of_day <- factor(user_data$time_of_day, levels = levels(df$time_of_day))
  
  # Check for missing values
  if (any(is.na(user_data[, user_required_cols]))) {
    stop("Error: Missing values in uploaded dataset")
  }
  
  # Check for invalid factor levels
  if (any(is.na(user_data$ad_id)) || any(is.na(user_data$day_of_week)) || any(is.na(user_data$time_of_day))) {
    stop("Error: Uploaded dataset contains values not present in training data")
  }
  
  # Predict probabilities for user data
  user_predictions <- predict(model, user_data)$predictions
  
  # Create results data frame
  user_results <- data.frame(
    day_of_week = user_data$day_of_week,
    time_of_day = user_data$time_of_day,
    prob_click = user_predictions[, "Yes"],
    prob_impression = user_predictions[, "No"]
  )
  
  # Sort by click probability
  user_results <- user_results %>%
    arrange(desc(prob_click))
  
  # Print first few predictions
  cat("\nPredictions for uploaded dataset:\n")
  print(head(user_results, 10))
  
  # Save predictions to a CSV file
  output_file_user <- file.path(dirname(user_file), "click_predictions.csv")
  write.csv(user_results, output_file_user, row.names = FALSE)
  cat("\nUser predictions saved to:", output_file_user, "\n")
  
}, error = function(e) {
  cat("Error processing uploaded dataset:", e$message, "\n")
})